"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Skeleton } from "@/components/skeleton";
import { createClient } from "@/lib/supabase/client";
import { parseReport } from "@/lib/report-record";
import {
  categoryLabels,
  reportCategories,
  reportStatuses,
  statusLabels,
  type Report,
  type ReportCategory,
  type ReportStatus,
} from "@/lib/types";
import { createDemoReport } from "./demo-action";
import { SignOutButton } from "./sign-out-button";

const AdminMap = dynamic(() => import("./admin-map"), {
  ssr: false,
  loading: () => (
    <div className="h-full" aria-busy="true">
      <span className="sr-only">Cargando el mapa…</span>
      <Skeleton className="h-full rounded-none" />
    </div>
  ),
});

const statusColors: Record<ReportStatus, string> = {
  recibido: "bg-red-600",
  en_proceso: "bg-amber-600",
  resuelto: "bg-green-700",
};

const dateFormat = new Intl.DateTimeFormat("es-SV", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/El_Salvador",
});

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return dateFormat.format(date);
}

const historyFormat = new Intl.DateTimeFormat("es-SV", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/El_Salvador",
});

function formatHistoryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return historyFormat.format(date);
}

function upsertReport(current: Report[], report: Report) {
  const next = current.some((item) => item.id === report.id)
    ? current.map((item) => (item.id === report.id ? report : item))
    : [report, ...current];
  next.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return next;
}

type ReportEvent = {
  id: string;
  from_status: ReportStatus | null;
  to_status: ReportStatus;
  note: string | null;
  created_at: string;
};

function parseEvent(value: unknown): ReportEvent | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const toStatus = row.to_status;
  if (typeof row.id !== "string" || typeof toStatus !== "string") return null;
  if (!(reportStatuses as readonly string[]).includes(toStatus)) return null;
  const fromStatus = row.from_status;
  return {
    id: row.id,
    from_status:
      typeof fromStatus === "string" &&
      (reportStatuses as readonly string[]).includes(fromStatus)
        ? (fromStatus as ReportStatus)
        : null,
    to_status: toStatus as ReportStatus,
    note: typeof row.note === "string" ? row.note : null,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
  };
}

export function AdminBoard({
  initialReports,
  loadError,
  demo,
}: {
  initialReports: Report[];
  loadError: boolean;
  demo: boolean;
}) {
  const [reports, setReports] = useState(initialReports);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [stage, setStage] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "todos">("todos");
  const [categoryFilter, setCategoryFilter] = useState<ReportCategory | "todas">("todas");
  const freshTimer = useRef<number | null>(null);
  const noticeTimer = useRef<number | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const knownIds = useRef(new Set(initialReports.map((report) => report.id)));

  const selectReport = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  useEffect(() => {
    function onFullscreenChange() {
      if (!document.fullscreenElement) setStage(false);
    }

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  async function enterStage() {
    setStage(true);
    try {
      await shellRef.current?.requestFullscreen();
    } catch {
      // Si el navegador no deja, el panel igual cubre la ventana.
    }
  }

  async function exitStage() {
    setStage(false);
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  }

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2500);
  }, []);

  const replaceReport = useCallback((report: Report) => {
    knownIds.current.add(report.id);
    setReports((current) => upsertReport(current, report));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let stopped = false;
    let started = false;

    function applyReport(report: Report, inserted: boolean) {
      const exists = knownIds.current.has(report.id);
      knownIds.current.add(report.id);
      setReports((current) => upsertReport(current, report));
      if (inserted || !exists) markFresh(report.id);
    }

    function markFresh(id: string) {
      setFreshId(id);
      if (freshTimer.current) window.clearTimeout(freshTimer.current);
      freshTimer.current = window.setTimeout(() => setFreshId(null), 1600);
    }

    async function start(token: string) {
      if (started || stopped) return;
      started = true;
      await supabase.realtime.setAuth(token);
      if (stopped) return;

      channel = supabase
        .channel("admin-reports")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "reports" },
          (payload) => {
            const report = parseReport(payload.new);
            if (report) applyReport(report, true);
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "reports" },
          (payload) => {
            const report = parseReport(payload.new);
            if (report) applyReport(report, false);
          },
        )
        .subscribe((status) => {
          setLive(status === "SUBSCRIBED");
        });
    }

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setLive(false);
        return;
      }
      const token = data.session?.access_token;
      if (token) {
        void start(token).catch(() => setLive(false));
      }
    }).catch(() => setLive(false));

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const token = session?.access_token;
      if (token) void start(token).catch(() => setLive(false));
    });

    return () => {
      stopped = true;
      authListener.subscription.unsubscribe();
      if (freshTimer.current) window.clearTimeout(freshTimer.current);
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  const selected = reports.find((report) => report.id === selectedId) ?? null;
  const mapReports = useMemo(
    () => reports.filter((report) => !report.is_hidden),
    [reports],
  );
  const counts = useMemo(() => {
    return {
      total: mapReports.length,
      recibido: mapReports.filter((report) => report.status === "recibido").length,
      en_proceso: mapReports.filter((report) => report.status === "en_proceso").length,
      resuelto: mapReports.filter((report) => report.status === "resuelto").length,
    };
  }, [mapReports]);
  const listedReports = useMemo(
    () =>
      reports.filter((report) => {
        const statusOk = statusFilter === "todos" || report.status === statusFilter;
        const categoryOk =
          categoryFilter === "todas" || report.category === categoryFilter;
        return statusOk && categoryOk;
      }),
    [reports, statusFilter, categoryFilter],
  );

  return (
    <div
      ref={shellRef}
      className={
        stage
          ? "fixed inset-0 z-50 flex h-dvh flex-col bg-paper"
          : "admin-shell flex min-h-0 flex-col"
      }
    >
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line bg-card px-4 py-3">
        {stage ? (
          <div>
            <p className="text-lg font-semibold text-muted">Total</p>
            <p className="text-7xl leading-none font-semibold tabular-nums" aria-live="polite">
              {counts.total}
            </p>
            <p className="mt-1 text-sm text-muted">{live ? "En vivo" : "Conectando…"}</p>
          </div>
        ) : (
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Panel de reportes
            </h1>
            <p className="text-sm text-muted" aria-live="polite">
              {live ? "En vivo" : "Conectando…"}
            </p>
          </div>
        )}
        <dl
          className={
            stage
              ? "flex flex-wrap gap-x-6 gap-y-1"
              : "grid grid-cols-2 gap-x-5 gap-y-1 text-sm sm:grid-cols-4 sm:text-base"
          }
        >
          {stage ? null : <Counter label="Total" value={counts.total} />}
          <Counter label="Recibidos" value={counts.recibido} dot="recibido" large={stage} />
          <Counter label="En proceso" value={counts.en_proceso} dot="en_proceso" large={stage} />
          <Counter label="Resueltos" value={counts.resuelto} dot="resuelto" large={stage} />
        </dl>
        <div className="flex flex-wrap items-center gap-2">
          {demo ? <DemoReportButton onNotice={showNotice} /> : null}
          {stage ? (
            <button
              type="button"
              onClick={exitStage}
              className="min-h-11 rounded-full border border-line bg-card px-4 text-sm font-semibold"
            >
              Salir
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={enterStage}
                className="min-h-11 rounded-full border border-line bg-card px-4 text-sm font-semibold"
              >
                Pantalla completa
              </button>
              <SignOutButton />
            </>
          )}
        </div>
      </header>
      {loadError ? (
        <p className="border-b border-line bg-card px-4 py-2 text-sm font-semibold text-red-800" role="alert">
          No pudimos cargar los reportes guardados. Los que lleguen en vivo sí
          van a aparecer.
        </p>
      ) : null}
      {notice ? (
        <p className="bg-accent px-4 py-2 text-sm font-semibold text-white" role="status">
          {notice}
        </p>
      ) : null}
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(280px,1fr)_minmax(240px,1fr)] md:grid-cols-[7fr_3fr] md:grid-rows-1">
        <div className="min-h-0">
          <AdminMap
            reports={mapReports}
            selectedId={selected?.is_hidden ? null : selectedId}
            freshId={freshId}
            onSelect={selectReport}
          />
        </div>
        <aside className="min-h-0 overflow-y-auto border-t border-line bg-card md:border-t-0 md:border-l">
          {selected ? (
            <ReportDetail
              key={selected.id}
              report={selected}
              onClose={() => setSelectedId(null)}
              onSaved={replaceReport}
              onNotice={showNotice}
            />
          ) : (
            <ReportList
              reports={listedReports}
              total={reports.length}
              freshId={freshId}
              statusFilter={statusFilter}
              categoryFilter={categoryFilter}
              showFilters={!stage}
              onStatusFilter={setStatusFilter}
              onCategoryFilter={setCategoryFilter}
              onSelect={selectReport}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

function Counter({
  label,
  value,
  dot,
  large = false,
}: {
  label: string;
  value: number;
  dot?: ReportStatus;
  large?: boolean;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-muted">
        {dot ? (
          <span className={`size-2.5 rounded-full ${statusColors[dot]}`} />
        ) : null}
        {label}
      </dt>
      <dd className={`${large ? "text-4xl" : "text-2xl"} font-semibold tabular-nums`}>{value}</dd>
    </div>
  );
}

function DemoReportButton({ onNotice }: { onNotice: (message: string) => void }) {
  const [pending, setPending] = useState(false);

  async function generate() {
    setPending(true);
    const result = await createDemoReport();
    setPending(false);
    onNotice(
      result.ok
        ? `Llegó el reporte de prueba ${result.trackingCode}.`
        : result.error,
    );
  }

  return (
    <button
      type="button"
      onClick={generate}
      disabled={pending}
      className="min-h-11 rounded-full border border-line bg-card px-4 text-sm font-semibold disabled:opacity-60"
    >
      {pending ? "Generando…" : "Reporte de prueba"}
    </button>
  );
}

function ReportList({
  reports,
  total,
  freshId,
  statusFilter,
  categoryFilter,
  showFilters,
  onStatusFilter,
  onCategoryFilter,
  onSelect,
}: {
  reports: Report[];
  total: number;
  freshId: string | null;
  statusFilter: ReportStatus | "todos";
  categoryFilter: ReportCategory | "todas";
  showFilters: boolean;
  onStatusFilter: (status: ReportStatus | "todos") => void;
  onCategoryFilter: (category: ReportCategory | "todas") => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      {showFilters ? (
      <div className="sticky top-0 z-10 grid gap-2 border-b border-line bg-card px-4 py-3">
        <label className="block text-sm font-semibold">
          Estado
          <select
            value={statusFilter}
            onChange={(event) => onStatusFilter(event.target.value as ReportStatus | "todos")}
            className="mt-1 min-h-11 w-full rounded-xl border border-line bg-card px-2 text-sm font-normal"
          >
            <option value="todos">Todos</option>
            {reportStatuses.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Categoría
          <select
            value={categoryFilter}
            onChange={(event) =>
              onCategoryFilter(event.target.value as ReportCategory | "todas")
            }
            className="mt-1 min-h-11 w-full rounded-xl border border-line bg-card px-2 text-sm font-normal"
          >
            <option value="todas">Todas</option>
            {reportCategories.map((category) => (
              <option key={category} value={category}>
                {categoryLabels[category]}
              </option>
            ))}
          </select>
        </label>
      </div>
      ) : null}
      {reports.length === 0 ? (
        <p className="px-4 py-6 text-base text-muted">
          {total === 0
            ? "Todavía no hay reportes."
            : "Ningún reporte coincide con esos filtros."}
        </p>
      ) : (
        <ul>
          {reports.map((report) => (
            <li key={report.id}>
              <button
                type="button"
                onClick={() => onSelect(report.id)}
                className={`flex min-h-11 w-full items-start gap-3 border-b border-line px-4 py-3 text-left hover:bg-paper ${
                  freshId === report.id ? "admin-row-fresh" : ""
                }`}
              >
                <span
                  className={`mt-1 size-3 shrink-0 rounded-full ${statusColors[report.status]}`}
                />
                <span className="min-w-0">
                  <span className="block font-semibold">
                    {categoryLabels[report.category]}
                    {report.is_hidden ? (
                      <span className="ml-2 text-xs font-semibold tracking-wide text-muted uppercase">
                        Oculto
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">
                    {report.tracking_code} · {statusLabels[report.status]}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">
                    {formatDate(report.created_at)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReportDetail({
  report,
  onClose,
  onSaved,
  onNotice,
}: {
  report: Report;
  onClose: () => void;
  onSaved: (report: Report) => void;
  onNotice: (message: string) => void;
}) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoState, setPhotoState] = useState<"empty" | "loading" | "ready" | "error">(
    report.photo_path ? "loading" : "empty",
  );
  const [events, setEvents] = useState<ReportEvent[]>([]);
  const [eventsState, setEventsState] = useState<"loading" | "ready" | "error">("loading");
  const [pending, setPending] = useState(false);
  const [confirmHide, setConfirmHide] = useState(false);

  useEffect(() => {
    if (!report.photo_path) return;

    let cancelled = false;
    const supabase = createClient();

    supabase.storage
      .from("report-photos")
      .createSignedUrl(report.photo_path, 60 * 10)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.signedUrl) {
          setPhotoState("error");
          setPhotoUrl(null);
          return;
        }
        setPhotoUrl(data.signedUrl);
        setPhotoState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setPhotoState("error");
        setPhotoUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [report.photo_path]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    void (async () => {
      try {
        const { data, error } = await supabase
          .from("report_events")
          .select("id, from_status, to_status, note, created_at")
          .eq("report_id", report.id)
          .order("created_at", { ascending: true });
        if (cancelled) return;
        if (error) {
          setEventsState("error");
          return;
        }
        setEvents((data ?? []).flatMap((row) => {
          const event = parseEvent(row);
          return event ? [event] : [];
        }));
        setEventsState("ready");
      } catch {
        if (!cancelled) setEventsState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [report.id, report.updated_at]);

  async function saveChange(patch: { status?: ReportStatus; is_hidden?: boolean }, notice: string) {
    setPending(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("reports")
        .update(patch)
        .eq("id", report.id)
        .select()
        .single();

      if (error) {
        onNotice("No pudimos guardar el cambio. Intentá de nuevo.");
        return;
      }

      const saved = parseReport(data);
      if (!saved) {
        onNotice("No pudimos guardar el cambio. Intentá de nuevo.");
        return;
      }
      onSaved(saved);
      setConfirmHide(false);
      onNotice(notice);
    } catch {
      onNotice("No pudimos guardar el cambio. Intentá de nuevo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="px-4 py-4">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline"
      >
        Volver a la lista
      </button>
      <p className="mt-4 text-sm font-semibold tracking-wide text-muted uppercase">
        {report.tracking_code}
      </p>
      <h2 className="mt-1 text-2xl font-semibold">
        {categoryLabels[report.category]}
      </h2>
      <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
        <span className={`size-2.5 rounded-full ${statusColors[report.status]}`} />
        {statusLabels[report.status]}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {reportStatuses.map((status) => (
          <button
            key={status}
            type="button"
            disabled={pending || report.status === status}
            aria-pressed={report.status === status}
            onClick={() =>
              saveChange({ status }, `Estado actualizado a ${statusLabels[status]}.`)
            }
            className={`min-h-11 rounded-xl px-2 text-sm font-semibold ${
              report.status === status
                ? `${statusColors[status]} text-white`
                : "border border-line bg-card hover:bg-paper"
            } ${pending && report.status !== status ? "opacity-60" : ""}`}
          >
            {statusLabels[status]}
          </button>
        ))}
      </div>
      {report.is_hidden ? (
        <p className="mt-3 text-sm font-semibold text-muted">
          Oculto. No se muestra en el mapa.
        </p>
      ) : confirmHide ? (
        <div className="mt-3 rounded-xl border border-line bg-paper px-3 py-3">
          <p className="text-sm leading-relaxed">
            ¿Seguro que querés ocultarlo? Ya no se va a ver en el mapa.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => saveChange({ is_hidden: true }, "Reporte oculto.")}
              className="min-h-11 rounded-xl bg-header px-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              Sí, ocultar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmHide(false)}
              className="min-h-11 rounded-xl border border-line bg-card px-3 text-sm font-semibold"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmHide(true)}
          className="mt-3 min-h-11 rounded-xl border border-line px-3 text-sm font-semibold hover:bg-paper"
        >
          Ocultar reporte
        </button>
      )}
      <StatusHistory state={eventsState} events={events} />
      <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-xl bg-paper">
        {photoState === "ready" && photoUrl ? (
          <Image
            src={photoUrl}
            alt={`Foto del reporte ${report.tracking_code}`}
            fill
            unoptimized
            className="object-cover"
          />
        ) : photoState === "loading" ? (
          <div className="h-full" aria-busy="true">
            <span className="sr-only">Cargando la foto…</span>
            <Skeleton className="h-full rounded-none" />
          </div>
        ) : (
          <p className="flex h-full items-center justify-center px-4 text-center text-sm text-muted">
            {photoState === "error"
              ? "No pudimos cargar la foto. Intentá abrir el reporte de nuevo."
              : "Este reporte no tiene foto."}
          </p>
        )}
      </div>
      <dl className="mt-4 space-y-3 text-sm leading-relaxed">
        <div>
          <dt className="font-semibold">Resumen de IA</dt>
          <dd className="text-muted">
            {report.ai_summary?.trim() || "Sin resumen de la IA."}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Descripción</dt>
          <dd className="text-muted">
            {report.description?.trim() || "Sin descripción."}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Fecha</dt>
          <dd className="text-muted">{formatDate(report.created_at)}</dd>
        </div>
        <div>
          <dt className="font-semibold">Código</dt>
          <dd className="font-semibold tracking-wide">{report.tracking_code}</dd>
        </div>
      </dl>
    </div>
  );
}

function StatusHistory({
  state,
  events,
}: {
  state: "loading" | "ready" | "error";
  events: ReportEvent[];
}) {
  return (
    <section className="mt-5" aria-labelledby="status-history-title">
      <h3 id="status-history-title" className="text-sm font-semibold">
        Historial de cambios de estado
      </h3>
      {state === "loading" ? (
        <div className="mt-3 space-y-2" aria-busy="true">
          <span className="sr-only">Cargando historial…</span>
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : state === "error" ? (
        <p className="mt-2 text-sm font-semibold text-red-800" role="alert">
          No pudimos leer el historial.
        </p>
      ) : events.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Todavía no hay cambios de estado.</p>
      ) : (
        <ol className="mt-3 space-y-3 border-l border-line pl-3">
          {events.map((event) => (
            <li key={event.id}>
              <p className="text-sm font-semibold">
                {event.from_status
                  ? `De ${statusLabels[event.from_status]} a ${statusLabels[event.to_status]}`
                  : statusLabels[event.to_status]}
              </p>
              {event.note ? <p className="text-sm text-muted">{event.note}</p> : null}
              <time
                dateTime={event.created_at}
                className="mt-0.5 block text-sm text-muted"
              >
                {formatHistoryDate(event.created_at)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
