export const reportCategories = [
  "bache",
  "luminaria",
  "basura",
  "fuga_agua",
  "drenaje",
  "arbol_caido",
  "otro",
] as const;

export type ReportCategory = (typeof reportCategories)[number];

export const reportStatuses = ["recibido", "en_proceso", "resuelto"] as const;

export type ReportStatus = (typeof reportStatuses)[number];

export const categoryLabels: Record<ReportCategory, string> = {
  bache: "Bache",
  luminaria: "Luminaria",
  basura: "Basura",
  fuga_agua: "Fuga de agua",
  drenaje: "Drenaje",
  arbol_caido: "Árbol caído",
  otro: "Otro",
};

export const statusLabels: Record<ReportStatus, string> = {
  recibido: "Recibido",
  en_proceso: "En proceso",
  resuelto: "Resuelto",
};

export type Report = {
  id: string;
  tracking_code: string;
  category: ReportCategory;
  ai_category: ReportCategory | null;
  ai_summary: string | null;
  ai_confidence: number | null;
  description: string | null;
  photo_path: string | null;
  lat: number;
  lng: number;
  address_hint: string | null;
  status: ReportStatus;
  is_hidden: boolean;
  consent: boolean;
  created_at: string;
  updated_at: string;
};
