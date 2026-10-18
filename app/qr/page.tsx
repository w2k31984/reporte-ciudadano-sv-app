import { Suspense } from "react";
import { connection } from "next/server";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { Skeleton } from "@/components/skeleton";

export default function QrPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 py-8">
      <Suspense fallback={<QrSkeleton />}>
        <QrCard />
      </Suspense>
    </main>
  );
}

async function QrCard() {
  await connection();
  const url = await reportUrl();
  const svg = await QRCode.toString(url, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#303845", light: "#ffffff" },
  });

  return (
    <>
      <h1 className="text-center text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        Reporta un problema de tu ciudad
      </h1>
      <div
        className="mt-8 w-full max-w-[min(72vw,520px)] rounded-3xl border border-line bg-card p-4 shadow-sm [&_svg]:h-auto [&_svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
        role="img"
        aria-label={`Código QR para abrir ${url}`}
      />
      <p className="mt-6 text-center text-lg text-muted">
        Escaneá el código o entrá a{" "}
        <a href={url} className="font-semibold break-all text-ink underline">
          {url}
        </a>
      </p>
    </>
  );
}

async function reportUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (configured) return `${configured}/reportar`;

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";
  const proto =
    headerStore.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");

  return `${proto}://${host}/reportar`;
}

function QrSkeleton() {
  return (
    <div className="flex w-full flex-col items-center" aria-busy="true">
      <span className="sr-only">Cargando el código QR…</span>
      <Skeleton className="h-14 w-full max-w-xl" />
      <Skeleton className="mt-8 aspect-square w-full max-w-[min(72vw,520px)] rounded-3xl" />
      <Skeleton className="mt-6 h-8 w-64" />
    </div>
  );
}
