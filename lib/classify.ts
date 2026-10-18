import { z } from "zod";
import { reportCategories, type ReportCategory } from "@/lib/types";

export const neutralClassification = {
  category: "otro" as const,
  summary: "No se pudo identificar el problema",
  confidence: 0.2,
};

const classificationSchema = z.object({
  category: z.enum(reportCategories),
  summary: z.string().trim().min(1),
  confidence: z.coerce.number().min(0).max(1),
});

export type Classification = {
  category: ReportCategory;
  summary: string;
  confidence: number;
};

export function parseClassification(value: unknown): Classification | null {
  const parsed = classificationSchema.safeParse(value);
  if (!parsed.success) return null;

  const summary = parsed.data.summary.split(/\s+/).slice(0, 12).join(" ");
  if (!summary) return null;

  return {
    category: parsed.data.category,
    summary,
    confidence: Math.round(parsed.data.confidence * 100) / 100,
  };
}
