"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        setError("No pudimos cerrar la sesión. Intentá de nuevo.");
        setPending(false);
        return;
      }
      router.push("/admin/login");
      router.refresh();
    } catch {
      setError("No pudimos cerrar la sesión. Intentá de nuevo.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={signOut}
        disabled={pending}
        className="min-h-11 rounded-full border border-line bg-card px-4 text-sm font-semibold hover:border-ink disabled:opacity-60"
      >
        {pending ? "Cerrando…" : "Cerrar sesión"}
      </button>
      {error ? (
        <p className="text-sm font-semibold text-red-800" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
