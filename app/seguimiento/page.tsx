import { Suspense } from "react";
import { CodigoForm } from "@/components/codigo-form";
import { Skeleton } from "@/components/skeleton";
import { StatusTimeline } from "@/components/status-timeline";
import { createClient } from "@/lib/supabase/server";
import { isTrackingCode, normalizeTrackingCode } from "@/lib/tracking-code";
import {
  categoryLabels,
  reportCategories,
  reportStatuses,
  type ReportCategory,
  type ReportStatus,
} from "@/lib/types";

export default function SeguimientoPage({
  searchParams,
}: PageProps<"/seguimiento">) {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">
        Seguimiento de tu reporte
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-muted">
        Con el código podés ver si ya lo recibimos, si está en proceso o si
        quedó resuelto.
      </p>
      <Suspense fallback={<SeguimientoSkeleton />}>
        <Consulta searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Consulta({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string }>;
}) {
  const { codigo } = await searchParams;
  const code = normalizeTrackingCode(codigo ?? "");

  return (
    <>
      <CodigoForm codigo={code} />
      {code ? (
        <Resultado code={code} />
      ) : (
        <p className="mt-6 rounded-2xl border border-dashed border-line bg-card px-4 py-4 text-base leading-relaxed text-muted">
          Todavía no consultaste ningún reporte. Escribí el código para ver en
          qué va.
        </p>
      )}
    </>
  );
}

async function Resultado({ code }: { code: string }) {
  if (!isTrackingCode(code)) {
    return (
      <p
        className="mt-6 rounded-2xl border border-line bg-card px-4 py-4 text-base leading-relaxed"
        role="alert"
      >
        Ese código no tiene el formato correcto. Se escribe{" "}
        <span className="font-semibold">SV-</span> seguido de 6 letras o
        números, por ejemplo SV-A3K9PQ.
      </p>
    );
  }

  const report = await loadStatus(code);

  if (report === "missing") {
    return (
      <p
        className="mt-6 rounded-2xl border border-line bg-card px-4 py-4 text-base leading-relaxed"
        role="alert"
      >
        No encontramos un reporte con el código{" "}
        <span className="font-semibold tracking-wide">{code}</span>. Revisá que
        esté bien escrito.
      </p>
    );
  }

  if (report === "error") {
    return (
      <p
        className="mt-6 rounded-2xl border border-line bg-card px-4 py-4 text-base leading-relaxed"
        role="alert"
      >
        No pudimos consultar el reporte. Intentá de nuevo en un momento.
      </p>
    );
  }

  const reportedOn = new Intl.DateTimeFormat("es-SV", {
    dateStyle: "long",
    timeZone: "America/El_Salvador",
  }).format(new Date(report.created_at));

  return (
    <section className="mt-6 rounded-2xl border border-line bg-card px-4 py-5">
      <p className="text-sm font-semibold tracking-wide text-muted uppercase">
        {report.tracking_code}
      </p>
      <h2 className="mt-1 text-2xl font-semibold">
        {categoryLabels[report.category]}
      </h2>
      <p className="mt-1 text-sm text-muted">Reportado el {reportedOn}</p>
      <StatusTimeline status={report.status} />
    </section>
  );
}

type StatusReport = {
  tracking_code: string;
  category: ReportCategory;
  status: ReportStatus;
  created_at: string;
};

async function loadStatus(
  code: string,
): Promise<StatusReport | "missing" | "error"> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_report_status", { code });

    if (error) return "error";

    const row = Array.isArray(data) ? data[0] : null;
    if (!row) return "missing";
    if (!isStatusReport(row)) return "error";

    return row;
  } catch {
    return "error";
  }
}

function SeguimientoSkeleton() {
  return (
    <div className="mt-8" aria-busy="true">
      <span className="sr-only">Cargando el seguimiento…</span>
      <Skeleton className="h-6 w-40" />
      <Skeleton className="mt-3 h-12 w-full" />
      <Skeleton className="mt-6 h-40 w-full" />
    </div>
  );
}

function isStatusReport(value: unknown): value is StatusReport {
  if (!value || typeof value !== "object") return false;

  const row = value as Record<string, unknown>;

  return (
    typeof row.tracking_code === "string" &&
    typeof row.category === "string" &&
    (reportCategories as readonly string[]).includes(row.category) &&
    typeof row.status === "string" &&
    (reportStatuses as readonly string[]).includes(row.status) &&
    typeof row.created_at === "string"
  );
}
