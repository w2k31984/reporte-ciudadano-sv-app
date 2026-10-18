"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { isTrackingCode, normalizeTrackingCode } from "@/lib/tracking-code";

export function CodigoForm({ codigo = "" }: { codigo?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(codigo);
  const [error, setError] = useState("");
  const [syncedCodigo, setSyncedCodigo] = useState(codigo);

  if (codigo !== syncedCodigo) {
    setSyncedCodigo(codigo);
    setValue(codigo);
    setError("");
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = normalizeTrackingCode(value);

    if (!isTrackingCode(code)) {
      setError(
        "El código se escribe SV- seguido de 6 letras o números. Por ejemplo, SV-A3K9PQ.",
      );
      return;
    }

    setError("");
    router.push(`/seguimiento?codigo=${code}`);
  }

  return (
    <form onSubmit={onSubmit} className="mt-8">
      <label htmlFor="codigo" className="block text-base font-semibold">
        ¿Ya tenés un código?
      </label>
      <p className="mt-1 text-sm text-muted">
        Es el que te dimos al reportar, por ejemplo SV-A3K9PQ.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          id="codigo"
          name="codigo"
          required
          value={value}
          onChange={(event) => {
            setValue(event.target.value.toUpperCase());
            setError("");
          }}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={9}
          placeholder="SV-A3K9PQ"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "codigo-error" : undefined}
          className="min-h-12 w-full rounded-xl border border-line bg-card px-3 text-base uppercase tracking-wide outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="min-h-12 shrink-0 rounded-xl bg-header px-5 text-base font-semibold text-white hover:bg-ink"
        >
          Consultar
        </button>
      </div>
      {error ? (
        <p id="codigo-error" className="mt-2 text-sm font-semibold text-red-800" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
