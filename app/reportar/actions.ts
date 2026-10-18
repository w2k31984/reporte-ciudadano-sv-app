"use server";

import { cookies, headers } from "next/headers";
import { extensionMatchesType, isPhotoPath, MAX_PHOTO_BYTES, sniffImageType } from "@/lib/photo-rules";
import { clientIp, rememberReport, reportAllowed } from "@/lib/rate-limit";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { reportCategories, type ReportCategory } from "@/lib/types";

const deviceCookie = "rc_device";
const devicePattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CreateReportInput = {
  category: ReportCategory;
  description: string;
  photoPath: string;
  lat: number;
  lng: number;
  consent: boolean;
  aiCategory?: ReportCategory | null;
  aiSummary?: string | null;
  aiConfidence?: number | null;
};

export type CreateReportResult =
  | { ok: true; trackingCode: string }
  | { ok: false; error: string };

function isCategory(value: string): value is ReportCategory {
  return reportCategories.some((category) => category === value);
}

async function deviceId() {
  const cookieStore = await cookies();
  const current = cookieStore.get(deviceCookie)?.value ?? "";
  if (devicePattern.test(current)) return current;

  const created = crypto.randomUUID();
  cookieStore.set(deviceCookie, created, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return created;
}

async function removePhoto(photoPath: string) {
  try {
    const storage = createServiceClient().storage.from("report-photos");
    const { error } = await storage.remove([photoPath]);
    if (error) return false;
    return true;
  } catch {
    return false;
  }
}

function declaredPhotoSize(response: Response) {
  const range = response.headers.get("content-range");
  const match = range?.match(/\/(\d+)$/);
  if (match) return Number(match[1]);

  const length = Number(response.headers.get("content-length") ?? "");
  return Number.isFinite(length) ? length : null;
}

async function photoIsAllowed(photoPath: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;

  const response = await fetch(`${url}/storage/v1/object/report-photos/${photoPath}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Range: "bytes=0-15",
    },
  });

  try {
    if (response.status !== 200 && response.status !== 206) return false;

    const size = declaredPhotoSize(response);
    if (size === null || size <= 0 || size > MAX_PHOTO_BYTES) return false;

    const bytes = new Uint8Array(await response.arrayBuffer());
    const mimeType = sniffImageType(bytes.subarray(0, 16));
    return mimeType !== null && extensionMatchesType(photoPath, mimeType);
  } finally {
    try {
      await response.body?.cancel();
    } catch {
      // El cuerpo ya se leyó para revisar el tipo de archivo.
    }
  }
}

async function saveReport(input: {
  category: ReportCategory;
  description: string | null;
  photoPath: string;
  lat: number;
  lng: number;
  aiCategory: ReportCategory | null;
  aiSummary: string | null;
  aiConfidence: number | null;
}) {
  const supabase = await createClient();
  const rpc = await supabase.rpc("submit_report", {
    p_category: input.category,
    p_description: input.description,
    p_photo_path: input.photoPath,
    p_lat: input.lat,
    p_lng: input.lng,
    p_ai_category: input.aiCategory,
    p_ai_summary: input.aiSummary,
    p_ai_confidence: input.aiConfidence,
  });

  if (!rpc.error && typeof rpc.data === "string" && rpc.data) return rpc.data;

  const missing =
    rpc.error?.code === "PGRST202" ||
    rpc.error?.message?.includes("submit_report") === true;
  if (!missing) return null;

  const inserted = await supabase.from("reports").insert({
    category: input.category,
    description: input.description,
    photo_path: input.photoPath,
    lat: input.lat,
    lng: input.lng,
    consent: true,
    status: "recibido",
    is_hidden: false,
    ai_category: input.aiCategory,
    ai_summary: input.aiSummary,
    ai_confidence: input.aiConfidence,
  });
  if (inserted.error) return null;

  const saved = await createServiceClient()
    .from("reports")
    .select("tracking_code")
    .eq("photo_path", input.photoPath)
    .maybeSingle();

  return typeof saved.data?.tracking_code === "string" ? saved.data.tracking_code : null;
}

export async function createReport(
  input: CreateReportInput,
): Promise<CreateReportResult> {
  if (!input.consent) {
    return { ok: false, error: "Tenés que aceptar que usemos tu foto." };
  }

  if (!isCategory(input.category)) {
    return { ok: false, error: "Elegí qué tipo de problema es." };
  }

  if (!isPhotoPath(input.photoPath)) {
    return { ok: false, error: "No pudimos usar esa foto. Intentá de nuevo." };
  }

  if (
    !Number.isFinite(input.lat) ||
    !Number.isFinite(input.lng) ||
    input.lat < -90 ||
    input.lat > 90 ||
    input.lng < -180 ||
    input.lng > 180
  ) {
    return { ok: false, error: "Marcá el punto en el mapa." };
  }

  try {
    const photoOk = await photoIsAllowed(input.photoPath);
    if (!photoOk) {
      await removePhoto(input.photoPath);
      return {
        ok: false,
        error: "La foto tiene que ser JPG, PNG o WebP y pesar hasta 5 MB.",
      };
    }

    const headerList = await headers();
    const ip = clientIp(headerList);
    const device = await deviceId();
    if (!reportAllowed(device, ip)) {
      await removePhoto(input.photoPath);
      return {
        ok: false,
        error: "Ya enviaste varios reportes. Esperá un rato antes de mandar otro.",
      };
    }

    const description = input.description.trim().slice(0, 800);
    const aiSummary = (input.aiSummary ?? "")
      .trim()
      .split(/\s+/)
      .slice(0, 12)
      .join(" ");
    const aiConfidence = Number(input.aiConfidence);
    const aiIsValid =
      !!input.aiCategory &&
      isCategory(input.aiCategory) &&
      aiSummary.length > 0 &&
      Number.isFinite(aiConfidence) &&
      aiConfidence >= 0 &&
      aiConfidence <= 1;

    const trackingCode = await saveReport({
      category: input.category,
      description: description || null,
      photoPath: input.photoPath,
      lat: input.lat,
      lng: input.lng,
      aiCategory: aiIsValid ? input.aiCategory ?? null : null,
      aiSummary: aiIsValid ? aiSummary : null,
      aiConfidence: aiIsValid ? Math.round(aiConfidence * 100) / 100 : null,
    });

    if (!trackingCode) {
      await removePhoto(input.photoPath);
      return {
        ok: false,
        error: "No pudimos guardar el reporte. Revisá tu conexión e intentá de nuevo.",
      };
    }

    rememberReport(device, ip);
    return { ok: true, trackingCode };
  } catch {
    await removePhoto(input.photoPath);
    return {
      ok: false,
      error: "No pudimos guardar el reporte. Revisá tu conexión e intentá de nuevo.",
    };
  }
}
