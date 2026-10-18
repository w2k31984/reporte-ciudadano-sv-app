import {
  reportCategories,
  reportStatuses,
  type Report,
  type ReportCategory,
  type ReportStatus,
} from "@/lib/types";

function isCategory(value: unknown): value is ReportCategory {
  return (
    typeof value === "string" &&
    (reportCategories as readonly string[]).includes(value)
  );
}

function isStatus(value: unknown): value is ReportStatus {
  return (
    typeof value === "string" &&
    (reportStatuses as readonly string[]).includes(value)
  );
}

function numberOrNull(value: unknown) {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

export function parseReport(value: unknown): Report | null {
  if (!value || typeof value !== "object") return null;

  const row = value as Record<string, unknown>;
  const lat = numberOrNull(row.lat);
  const lng = numberOrNull(row.lng);

  if (typeof row.id !== "string" || typeof row.tracking_code !== "string") {
    return null;
  }
  if (!isCategory(row.category) || !isStatus(row.status)) return null;
  if (lat == null || lng == null) return null;

  return {
    id: row.id,
    tracking_code: row.tracking_code,
    category: row.category,
    ai_category: isCategory(row.ai_category) ? row.ai_category : null,
    ai_summary: typeof row.ai_summary === "string" ? row.ai_summary : null,
    ai_confidence: numberOrNull(row.ai_confidence),
    description: typeof row.description === "string" ? row.description : null,
    photo_path: typeof row.photo_path === "string" ? row.photo_path : null,
    lat,
    lng,
    address_hint: typeof row.address_hint === "string" ? row.address_hint : null,
    status: row.status,
    is_hidden: row.is_hidden === true,
    consent: row.consent === true,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
  };
}
