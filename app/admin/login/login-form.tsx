"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError("No pudimos entrar. Revisá el correo y la contraseña.");
        setPending(false);
        return;
      }

      const demo = new URLSearchParams(window.location.search).get("demo") === "1";
      window.location.assign(demo ? "/admin?demo=1" : "/admin");
    } catch {
      setError("No pudimos entrar. Revisá tu conexión e intentá de nuevo.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      <div>
        <label htmlFor="email" className="block text-sm font-semibold">
          Correo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          className="mt-2 min-h-12 w-full rounded-xl border border-line bg-card px-3 text-base outline-none focus:border-accent"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-semibold">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="mt-2 min-h-12 w-full rounded-xl border border-line bg-card px-3 text-base outline-none focus:border-accent"
        />
      </div>
      {error ? (
        <p className="text-sm font-semibold text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="min-h-14 w-full rounded-2xl bg-accent text-lg font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
