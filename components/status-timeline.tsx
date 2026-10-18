import { reportStatuses, statusLabels, type ReportStatus } from "@/lib/types";

const hints: Record<ReportStatus, string> = {
  recibido: "Recibimos tu reporte. Pronto lo van a revisar.",
  en_proceso: "Ya lo están atendiendo.",
  resuelto: "Este reporte quedó resuelto.",
};

export function StatusTimeline({ status }: { status: ReportStatus }) {
  const current = reportStatuses.indexOf(status);

  return (
    <div className="mt-6">
      <p className="text-lg leading-relaxed">{hints[status]}</p>
      <div className="relative mt-6">
        <div className="absolute top-4 right-[16.666%] left-[16.666%] h-0.5 bg-line" />
        <div
          className="absolute top-4 left-[16.666%] h-0.5 bg-accent"
          style={{ width: `${(current / 2) * 66.666}%` }}
        />
        <ol className="relative grid grid-cols-3">
          {reportStatuses.map((step, index) => {
            const active = index === current;
            const done = index < current;

            return (
              <li
                key={step}
                aria-current={active ? "step" : undefined}
                className="flex flex-col items-center text-center"
              >
                <span
                  className={`flex size-8 items-center justify-center rounded-full text-sm font-semibold ${
                    active
                      ? "bg-accent text-white ring-4 ring-accent/25"
                      : done
                        ? "bg-accent text-white"
                        : "bg-card text-muted ring-1 ring-line"
                  }`}
                >
                  {index + 1}
                </span>
                <span
                  className={`mt-3 text-sm leading-tight font-semibold ${
                    active ? "text-ink" : "text-muted"
                  }`}
                >
                  {statusLabels[step]}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
