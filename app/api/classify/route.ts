import { neutralClassification, parseClassification } from "@/lib/classify";
import type { Classification } from "@/lib/classify";
import { allowClassify, clientIp } from "@/lib/rate-limit";

const TIMEOUT_MS = 8000;
const MAX_BASE64_LENGTH = 7_000_000;
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const prompt = `Mira la foto y responde SOLO con un JSON, sin markdown ni texto extra:
{"category":"bache","summary":"descripcion corta","confidence":0.8}

category debe ser exactamente una de estas: bache, luminaria, basura, fuga_agua, drenaje, arbol_caido, otro.
summary: maximo 12 palabras, en español, describiendo lo que se ve.
confidence: numero entre 0 y 1.

Si la imagen no muestra un problema urbano, usa category "otro" y una confidence baja.`;

function fallback() {
  return Response.json(neutralClassification);
}

function stripDataUrl(value: string) {
  const comma = value.indexOf(",");
  if (value.startsWith("data:") && comma !== -1) {
    return value.slice(comma + 1);
  }
  return value;
}

function readModelText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return "";
  const parts = (
    candidates[0] as { content?: { parts?: Array<{ text?: string }> } } | undefined
  )?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part) => part.text ?? "").join("");
}

function parseModelJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const value = JSON.parse(text.slice(start, end + 1)) as {
      category?: unknown;
    };
    if (typeof value.category === "string") {
      value.category = value.category.trim().toLowerCase();
    }
    return value;
  } catch {
    return null;
  }
}

async function imageFromSignedUrl(imageUrl: string, signal: AbortSignal) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  let target: URL;
  try {
    target = new URL(imageUrl);
  } catch {
    return null;
  }

  const allowedHost = new URL(supabaseUrl).host;
  if (target.protocol !== "https:" || target.host !== allowedHost) return null;

  const response = await fetch(target, { signal });
  if (!response.ok) return null;

  const mimeType =
    response.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
  if (!allowedMimeTypes.has(mimeType)) return null;

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > 5 * 1024 * 1024) return null;
  return { base64: bytes.toString("base64"), mimeType };
}

async function classifyImage(
  base64: string,
  mimeType: string,
  signal: AbortSignal,
): Promise<Classification> {
  const apiKey = process.env.VISION_API_KEY;
  const model = process.env.VISION_MODEL;
  if (!apiKey || !model) return neutralClassification;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: mimeType, data: base64 } },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) return neutralClassification;

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return neutralClassification;
  }

  return parseClassification(parseModelJson(readModelText(payload))) ?? neutralClassification;
}

export async function POST(request: Request) {
  const signal = AbortSignal.timeout(TIMEOUT_MS);

  try {
    if (!allowClassify(clientIp(request.headers))) return fallback();

    const body = (await request.json()) as {
      imageBase64?: unknown;
      imageUrl?: unknown;
      mimeType?: unknown;
    };

    let base64 = "";
    let mimeType = "image/jpeg";

    if (typeof body.imageBase64 === "string" && body.imageBase64.trim()) {
      base64 = stripDataUrl(body.imageBase64.trim());
      if (typeof body.mimeType === "string" && allowedMimeTypes.has(body.mimeType)) {
        mimeType = body.mimeType;
      } else if (typeof body.mimeType === "string" && body.mimeType.trim()) {
        return fallback();
      }
    } else if (typeof body.imageUrl === "string" && body.imageUrl.trim()) {
      const downloaded = await imageFromSignedUrl(body.imageUrl.trim(), signal);
      if (!downloaded) return fallback();
      base64 = downloaded.base64;
      mimeType = downloaded.mimeType;
    } else {
      return fallback();
    }

    if (!base64 || base64.length > MAX_BASE64_LENGTH) return fallback();

    const result = await classifyImage(base64, mimeType, signal);
    return Response.json(result);
  } catch {
    return fallback();
  }
}
