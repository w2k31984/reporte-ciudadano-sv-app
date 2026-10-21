import { createReport, type CreateReportInput } from "@/app/reportar/actions";

function isReportInput(value: unknown): value is CreateReportInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<CreateReportInput>;
  return (
    typeof input.category === "string" &&
    typeof input.description === "string" &&
    typeof input.photoPath === "string" &&
    typeof input.lat === "number" &&
    typeof input.lng === "number" &&
    typeof input.consent === "boolean"
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: "No pudimos leer el reporte." },
      { status: 400 },
    );
  }

  if (!isReportInput(body)) {
    return Response.json(
      { ok: false, error: "No pudimos leer el reporte." },
      { status: 400 },
    );
  }

  try {
    const result = await createReport(body);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    const missingConfig =
      error instanceof Error && error.message.includes("SUPABASE");
    return Response.json(
      {
        ok: false,
        error: missingConfig
          ? "Falta la configuración del servidor. Cargá las variables en Vercel y volvé a desplegar."
          : "No pudimos guardar el reporte. Revisá tu conexión e intentá de nuevo.",
      },
      { status: 500 },
    );
  }
}
