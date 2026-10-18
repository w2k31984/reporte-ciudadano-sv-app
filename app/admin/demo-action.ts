"use server";

import { createClient } from "@/lib/supabase/server";
import { reportCategories, type ReportCategory } from "@/lib/types";

const CENTER = { lat: 13.6989, lng: -89.2182 };

const samples: Record<ReportCategory, { summary: string; description: string }> = {
  bache: {
    summary: "Bache en la calzada",
    description: "Hay un bache que complica el paso.",
  },
  luminaria: {
    summary: "Luminaria apagada en la cuadra",
    description: "El poste de esta cuadra no enciende.",
  },
  basura: {
    summary: "Basura acumulada en la acera",
    description: "Hay basura que no han recogido.",
  },
  fuga_agua: {
    summary: "Fuga de agua en la calle",
    description: "Sale agua y se forma un charco.",
  },
  drenaje: {
    summary: "Tragante obstruido",
    description: "El drenaje está tapado.",
  },
  arbol_caido: {
    summary: "Árbol caído en la vía",
    description: "Un árbol ocupa parte de la calle.",
  },
  otro: {
    summary: "Problema en la vía pública",
    description: "Hay un problema que necesita revisión.",
  },
};

export type DemoReportResult = { ok: true; trackingCode: string } | { ok: false; error: string };

function jitter(base: number) {
  return Math.round((base + (Math.random() - 0.5) * 0.016) * 1e5) / 1e5;
}

export async function createDemoReport(): Promise<DemoReportResult> {
  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (authError || !auth.user) {
      return { ok: false, error: "Tenés que entrar para generar un reporte de prueba." };
    }

    const category = reportCategories[Math.floor(Math.random() * reportCategories.length)];
    const sample = samples[category];
    const { data, error } = await supabase
      .from("reports")
      .insert({
        category,
        ai_category: category,
        ai_summary: sample.summary,
        ai_confidence: Math.round((0.75 + Math.random() * 0.2) * 100) / 100,
        description: sample.description,
        lat: jitter(CENTER.lat),
        lng: jitter(CENTER.lng),
        status: "recibido",
        is_hidden: false,
        consent: true,
      })
      .select("tracking_code")
      .single();

    if (error || !data?.tracking_code) {
      return {
        ok: false,
        error: "No pudimos crear el reporte de prueba. Revisá la conexión e intentá de nuevo.",
      };
    }

    return { ok: true, trackingCode: data.tracking_code };
  } catch {
    return {
      ok: false,
      error: "No pudimos crear el reporte de prueba. Revisá la conexión e intentá de nuevo.",
    };
  }
}
