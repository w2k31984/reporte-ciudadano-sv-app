import { Suspense } from "react";
import { connection } from "next/server";
import { redirect, unstable_rethrow } from "next/navigation";
import { Skeleton } from "@/components/skeleton";
import { parseReport } from "@/lib/report-record";
import { createClient } from "@/lib/supabase/server";
import type { Report } from "@/lib/types";
import { AdminBoard } from "./admin-board";

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <Suspense fallback={<AdminSkeleton />}>
        <AdminPanel searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function AdminSkeleton() {
  return (
    <div className="admin-shell flex flex-col" aria-busy="true">
      <span className="sr-only">Cargando el panel…</span>
      <div className="flex items-center gap-4 border-b border-line bg-card px-4 py-4">
        <Skeleton className="h-11 w-48" />
        <Skeleton className="h-11 w-28" />
        <Skeleton className="ml-auto h-11 w-32" />
      </div>
      <div className="grid min-h-0 flex-1 md:grid-cols-[7fr_3fr]">
        <Skeleton className="h-full rounded-none" />
        <div className="space-y-3 border-l border-line bg-card p-4">
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </div>
    </div>
  );
}

async function AdminPanel({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const demoValue = params.demo;
  const demo = demoValue === "1" || (Array.isArray(demoValue) && demoValue.includes("1"));

  let failed = false;
  let loadError = false;
  let reports: Report[] = [];

  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();

    if (!auth.user) {
      redirect(demo ? "/admin/login?demo=1" : "/admin/login");
    }

    const { data, error } = await supabase
      .from("reports")
      .select(
        "id, tracking_code, category, ai_category, ai_summary, ai_confidence, description, photo_path, lat, lng, address_hint, status, is_hidden, consent, created_at, updated_at",
      )
      .order("created_at", { ascending: false });

    reports = (data ?? [])
      .map((row) => parseReport(row))
      .filter((report): report is Report => report !== null);
    loadError = Boolean(error);
  } catch (error) {
    unstable_rethrow(error);
    failed = true;
  }

  if (failed) {
    return (
      <p className="px-4 py-6 text-base font-semibold text-red-800" role="alert">
        No pudimos abrir el panel. Revisá la conexión e intentá de nuevo.
      </p>
    );
  }

  return <AdminBoard initialReports={reports} loadError={loadError} demo={demo} />;
}
