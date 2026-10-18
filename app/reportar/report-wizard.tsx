"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compress-image";
import { isAllowedPhotoFile, MAX_PHOTO_BYTES } from "@/lib/photo-rules";
import {
  categoryLabels,
  reportCategories,
  type ReportCategory,
} from "@/lib/types";
import { Skeleton } from "@/components/skeleton";
import { createReport } from "./actions";
import type { Classification } from "@/lib/classify";

const ReportMap = dynamic(() => import("./report-map"), {
  ssr: false,
  loading: () => (
    <div className="h-full" aria-busy="true">
      <span className="sr-only">Cargando el mapa…</span>
      <Skeleton className="h-full rounded-none" />
    </div>
  ),
});

const steps = ["Foto", "Lugar", "Detalles"] as const;

type Position = { lat: number; lng: number };
type GeoState = "idle" | "loading" | "granted" | "denied" | "unavailable";

function CategoryIcon({ category }: { category: ReportCategory }) {
  const props = {
    width: 28,
    height: 28,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (category) {
    case "bache":
      return (
        <svg {...props}>
          <path d="M3 16c2.2-3 3.2 2.5 5.2-.2 2-2.6 2.6 2.4 4.8-.1 2.1-2.4 2.8 2.2 5 .2" />
          <path d="M3 19.5h18" />
        </svg>
      );
    case "luminaria":
      return (
        <svg {...props}>
          <path d="M9 18h6" />
          <path d="M10 21h4" />
          <path d="M12 2a6 6 0 0 0-3 11c.6.6 1 1.4 1 2.2V16h4v-.8c0-.8.4-1.6 1-2.2A6 6 0 0 0 12 2z" />
        </svg>
      );
    case "basura":
      return (
        <svg {...props}>
          <path d="M5 7h14" />
          <path d="M9 7V5h6v2" />
          <path d="M7 7l1 13h8l1-13" />
        </svg>
      );
    case "fuga_agua":
      return (
        <svg {...props}>
          <path d="M12 3s6 6.2 6 10a6 6 0 0 1-12 0c0-3.8 6-10 6-10z" />
        </svg>
      );
    case "drenaje":
      return (
        <svg {...props}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M4 9h16M4 14h16M9 4v16M15 4v16" />
        </svg>
      );
    case "arbol_caido":
      return (
        <svg {...props}>
          <path d="M4 19h16" />
          <path d="M7 19 16 8" />
          <path d="M16 8c-2.5 0-4 1.6-4 1.6S13.2 6 16 6s4 2.2 4 3.6S18.2 8 16 8z" />
        </svg>
      );
    case "otro":
      return (
        <svg {...props}>
          <circle cx="6" cy="12" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="18" cy="12" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

function isClassification(value: Partial<Classification>): value is Classification {
  return (
    typeof value.category === "string" &&
    (reportCategories as readonly string[]).includes(value.category) &&
    typeof value.summary === "string" &&
    value.summary.trim().length > 0 &&
    typeof value.confidence === "number" &&
    value.confidence >= 0 &&
    value.confidence <= 1
  );
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function ReportWizard() {
  const [step, setStep] = useState(1);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [focusKey, setFocusKey] = useState(0);
  const [mapEpoch, setMapEpoch] = useState(0);
  const [geoState, setGeoState] = useState<GeoState>("idle");
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [suggestion, setSuggestion] = useState<Classification | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [description, setDescription] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackingCode, setTrackingCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const sendingLock = useRef(false);
  const userMovedPin = useRef(false);
  const categoryTouched = useRef(false);
  const suggestionRef = useRef<Classification | null>(null);
  const classifyRequest = useRef(0);
  const classifyPromise = useRef<Promise<void> | null>(null);
  const geoRequest = useRef(0);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function requestLocation() {
    if (!navigator.geolocation) {
      setGeoState("unavailable");
      return;
    }

    const requestId = geoRequest.current + 1;
    geoRequest.current = requestId;
    setGeoState("loading");
    navigator.geolocation.getCurrentPosition(
      (result) => {
        if (requestId !== geoRequest.current) return;
        setGeoState("granted");
        if (userMovedPin.current) return;
        setPosition({
          lat: result.coords.latitude,
          lng: result.coords.longitude,
        });
        setFocusKey((value) => value + 1);
      },
      () => {
        if (requestId !== geoRequest.current) return;
        setGeoState("denied");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  function classifyPhoto(blob: Blob) {
    const requestId = classifyRequest.current + 1;
    classifyRequest.current = requestId;
    setClassifying(true);

    const task = (async () => {
      try {
        const imageBase64 = await blobToBase64(blob);
        const response = await fetch("/api/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64, mimeType: "image/jpeg" }),
        });
        if (!response.ok || requestId !== classifyRequest.current) return;

        const data = (await response.json()) as Partial<Classification>;
        if (requestId !== classifyRequest.current || !isClassification(data)) return;

        suggestionRef.current = data;
        setSuggestion(data);
        if (!categoryTouched.current) setCategory(data.category);
      } catch {
        if (requestId !== classifyRequest.current) return;
      } finally {
        if (requestId === classifyRequest.current) setClassifying(false);
      }
    })();

    classifyPromise.current = task;
    void task.finally(() => {
      if (classifyPromise.current === task) classifyPromise.current = null;
    });
  }

  async function onPhotoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!isAllowedPhotoFile(file)) {
      setPhoto(null);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      setError(
        file.size > MAX_PHOTO_BYTES
          ? "La foto puede pesar hasta 5 MB."
          : "La foto tiene que ser JPG, PNG o WebP.",
      );
      return;
    }

    setError(null);
    setPreparingPhoto(true);
    try {
      const blob = await compressImage(file);
      if (blob.size > MAX_PHOTO_BYTES) {
        setPhoto(null);
        setError("La foto puede pesar hasta 5 MB.");
        return;
      }
      const url = URL.createObjectURL(blob);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return url;
      });
      setPhoto(blob);
      categoryTouched.current = false;
      suggestionRef.current = null;
      setSuggestion(null);
      setCategory(null);
      void classifyPhoto(blob);
    } catch {
      setPhoto(null);
      setError("No pudimos leer esa foto. Probá con otra.");
    } finally {
      setPreparingPhoto(false);
    }
  }

  function pickPoint(lat: number, lng: number) {
    geoRequest.current += 1;
    userMovedPin.current = true;
    setPosition({ lat, lng });
    setGeoState("granted");
    setError(null);
  }

  function goNext() {
    setError(null);
    if (step === 1) {
      if (!photo) {
        setError("Primero agregá una foto del problema.");
        return;
      }
      setStep(2);
      if (!position) requestLocation();
      return;
    }
    if (step === 2) {
      if (!position) {
        setError("Marcá el lugar en el mapa.");
        return;
      }
      setStep(3);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sendingLock.current) return;
    if (!photo || !position || !category) return;
    if (!consent) {
      setError("Tenés que aceptar que usemos tu foto.");
      return;
    }

    sendingLock.current = true;
    setSending(true);
    setError(null);

    if (classifyPromise.current) {
      await Promise.race([
        classifyPromise.current,
        new Promise((resolve) => window.setTimeout(resolve, 8000)),
      ]);
    }

    let succeeded = false;

    try {
      const photoPath = `${crypto.randomUUID()}.jpg`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("report-photos")
        .upload(photoPath, photo, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        setError("No pudimos subir la foto. Revisá tu conexión e intentá de nuevo.");
        return;
      }

      const ai = suggestionRef.current;
      const result = await createReport({
        category,
        description,
        photoPath,
        lat: position.lat,
        lng: position.lng,
        consent: true,
        aiCategory: ai?.category ?? null,
        aiSummary: ai?.summary ?? null,
        aiConfidence: ai?.confidence ?? null,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      succeeded = true;
      setTrackingCode(result.trackingCode);
    } catch (error) {
      const missingConfig =
        error instanceof Error && error.message.includes("NEXT_PUBLIC_SUPABASE");
      setError(
        missingConfig
          ? "Falta la configuración del servidor. Cargá las variables en Vercel y volvé a desplegar."
          : "No pudimos enviar el reporte. Revisá tu conexión e intentá de nuevo.",
      );
    } finally {
      setSending(false);
      if (!succeeded) sendingLock.current = false;
    }
  }

  async function copyCode() {
    if (!trackingCode) return;
    try {
      await navigator.clipboard.writeText(trackingCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("No se pudo copiar. Seleccioná el código y copialo a mano.");
    }
  }

  function startOver() {
    classifyRequest.current += 1;
    geoRequest.current += 1;
    sendingLock.current = false;
    userMovedPin.current = false;
    categoryTouched.current = false;
    suggestionRef.current = null;
    classifyPromise.current = null;
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setStep(1);
    setPhoto(null);
    setPreparingPhoto(false);
    setPosition(null);
    setFocusKey(0);
    setMapEpoch((value) => value + 1);
    setGeoState("idle");
    setCategory(null);
    setSuggestion(null);
    setClassifying(false);
    setDescription("");
    setConsent(false);
    setSending(false);
    setError(null);
    setTrackingCode(null);
    setCopied(false);
  }

  if (trackingCode) {
    return (
      <section className="py-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">
          Reporte recibido
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Guardá tu código
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-muted">
          Con este código podés consultar si ya lo están atendiendo.
        </p>
        <p className="mt-8 rounded-2xl border border-line bg-card px-4 py-6 text-center text-4xl font-semibold tracking-[0.14em] select-all">
          {trackingCode}
        </p>
        <button
          type="button"
          onClick={copyCode}
          className="mt-4 min-h-14 w-full rounded-2xl bg-accent text-lg font-semibold text-white hover:bg-accent-hover"
        >
          {copied ? "Código copiado" : "Copiar código"}
        </button>
        <Link
          href={`/seguimiento?codigo=${trackingCode}`}
          className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-line bg-card text-base font-semibold"
        >
          Consultar este reporte
        </Link>
        <button
          type="button"
          onClick={startOver}
          className="mt-3 min-h-14 w-full rounded-2xl border border-line bg-card text-lg font-semibold"
        >
          Regresar al inicio
        </button>
        {error ? (
          <p className="mt-4 text-sm font-semibold text-red-800" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    );
  }

  const locationHint =
    geoState === "loading"
      ? "Estamos buscando tu ubicación…"
      : geoState === "granted"
        ? "Arrastrá el pin si no quedó en el punto exacto."
        : geoState === "denied" || geoState === "unavailable"
          ? "No pudimos usar tu ubicación. Tocá el mapa para marcar el lugar."
          : "Tocá el mapa si querés mover el punto.";

  return (
    <div
      className={`flex w-full flex-col py-2 ${
        step === 2 ? "min-h-[calc(100dvh-7.5rem)] flex-1" : "mx-auto max-w-lg"
      }`}
    >
      <h1 className="text-3xl font-semibold tracking-tight">
        Reportar un problema
      </h1>
      <ol className="mt-5 grid grid-cols-3 gap-2">
        {steps.map((label, index) => {
          const number = index + 1;
          const active = step === number;
          const done = step > number;
          return (
            <li
              key={label}
              aria-current={active ? "step" : undefined}
              className={`rounded-full px-2 py-2 text-center text-sm font-semibold ${
                active
                  ? "bg-accent text-white"
                  : done
                    ? "bg-header text-white"
                    : "bg-card text-muted"
              }`}
            >
              {number}. {label}
            </li>
          );
        })}
      </ol>

      {step === 1 ? (
        <section className="mt-6">
          <h2 className="text-xl font-semibold">Foto del problema</h2>
          <p className="mt-2 text-base leading-relaxed text-muted">
            Tomala con la cámara o elegila de tu galería.
          </p>
          <input
            ref={cameraRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            aria-label="Tomar foto con la cámara"
            className="sr-only"
            onChange={onPhotoSelected}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Elegir una foto de la galería"
            className="sr-only"
            onChange={onPhotoSelected}
          />
          {previewUrl ? (
            <Image
              src={previewUrl}
              alt="Vista previa de la foto del reporte"
              width={1280}
              height={960}
              unoptimized
              className="mt-4 aspect-[4/3] h-auto w-full rounded-2xl border border-line object-cover"
            />
          ) : (
            <div className="mt-4 flex aspect-[4/3] items-center justify-center rounded-2xl border border-dashed border-line bg-card px-6 text-center text-muted">
              {preparingPhoto ? "Preparando la foto…" : "Todavía no hay foto"}
            </div>
          )}
          <div className="mt-4 grid gap-2">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={preparingPhoto}
              className="min-h-14 rounded-2xl bg-header text-lg font-semibold text-white disabled:opacity-60"
            >
              Tomar foto
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              disabled={preparingPhoto}
              className="min-h-12 rounded-2xl border border-line bg-card text-base font-semibold disabled:opacity-60"
            >
              Elegir de la galería
            </button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="mt-6 flex min-h-0 flex-1 flex-col">
          <h2 className="text-xl font-semibold">¿Dónde está?</h2>
          <p className="mt-2 text-base leading-relaxed text-muted">{locationHint}</p>
          <div className="report-map relative z-0 mt-4 min-h-64 w-full flex-1 overflow-hidden rounded-2xl border border-line sm:min-h-80 md:min-h-96">
            <div className="absolute inset-0">
              <ReportMap
                key={mapEpoch}
                lat={position?.lat ?? null}
                lng={position?.lng ?? null}
                focusKey={focusKey}
                onPick={pickPoint}
              />
            </div>
          </div>
          {geoState === "denied" || geoState === "unavailable" ? (
            <button
              type="button"
              onClick={() => {
                userMovedPin.current = false;
                requestLocation();
              }}
              className="mt-3 min-h-12 w-full rounded-2xl border border-line bg-card text-base font-semibold"
            >
              Intentar con mi ubicación
            </button>
          ) : null}
        </section>
      ) : null}

      {step === 3 ? (
        <form id="report-details" className="mt-6" onSubmit={onSubmit}>
          <h2 className="text-xl font-semibold">Contanos qué es</h2>
          <fieldset className="mt-4" disabled={sending}>
            <legend className="text-base font-semibold">Elegí una categoría</legend>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {reportCategories.map((item) => {
                const selected = category === item;
                const suggested = suggestion?.category === item;
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      categoryTouched.current = true;
                      setCategory(item);
                    }}
                    className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border px-2 text-sm font-semibold ${
                      item === "otro" ? "col-span-2" : ""
                    } ${
                      selected
                        ? "border-accent bg-accent text-white"
                        : "border-line bg-card"
                    }`}
                  >
                    <CategoryIcon category={item} />
                    {categoryLabels[item]}
                    {suggested ? (
                      <span
                        className={`text-xs font-semibold uppercase tracking-wide ${
                          selected ? "text-white/90" : "text-accent"
                        }`}
                      >
                        Sugerido por IA
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {classifying ? (
              <p className="mt-3 text-sm text-muted">
                Revisando la foto para sugerirte una categoría…
              </p>
            ) : suggestion ? (
              <p className="mt-3 text-sm text-muted">{suggestion.summary}</p>
            ) : null}
          </fieldset>
          <label htmlFor="description" className="mt-5 block text-sm font-semibold">
            Descripción <span className="font-normal text-muted">(opcional)</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={800}
            rows={3}
            disabled={sending}
            placeholder="Por ejemplo: hay un bache grande frente a la parada."
            className="mt-2 w-full rounded-xl border border-line bg-card px-3 py-3 text-base outline-none focus:border-accent"
          />
          <label className="mt-4 flex min-h-11 items-center gap-3 text-base leading-snug">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              disabled={sending}
              className="size-6 shrink-0 accent-accent"
            />
            <span>Acepto que mi foto se use para atender este reporte</span>
          </label>
        </form>
      ) : null}

      {error ? (
        <p className="mt-4 text-sm font-semibold text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex shrink-0 gap-2">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setStep((value) => value - 1);
            }}
            disabled={sending}
            className="min-h-14 flex-1 rounded-2xl border border-line bg-card text-base font-semibold disabled:opacity-60"
          >
            Atrás
          </button>
        ) : null}
        {step < 3 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={preparingPhoto || (step === 1 && !photo)}
            className="min-h-14 flex-[2] rounded-2xl bg-accent text-lg font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            Continuar
          </button>
        ) : (
          <button
            type="submit"
            form="report-details"
            disabled={sending || !category || !consent}
            className="min-h-14 flex-[2] rounded-2xl bg-accent text-lg font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {sending ? "Enviando tu reporte…" : "Enviar reporte"}
          </button>
        )}
      </div>
    </div>
  );
}
