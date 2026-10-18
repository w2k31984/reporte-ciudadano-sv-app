"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  categoryLabels,
  statusLabels,
  type Report,
  type ReportCategory,
  type ReportStatus,
} from "@/lib/types";

const SAN_SALVADOR: [number, number] = [13.6989, -89.2182];

const statusColors: Record<ReportStatus, string> = {
  recibido: "#dc2626",
  en_proceso: "#d97706",
  resuelto: "#15803d",
};

const categoryGlyphs: Record<ReportCategory, string> = {
  bache: `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><ellipse cx="8" cy="9" rx="5" ry="2.4" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M4.5 9.2c1.2-.8 2.2.6 3.5 0s2.2-.8 3.5 0" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  luminaria: `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="6.5" r="3" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M8 9.5v3.2M6.2 13.2h3.6" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  basura: `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4.2 5.2h7.6l-.6 7.2H4.8l-.6-7.2z" fill="none" stroke="#fff" stroke-width="1.4"/><path d="M3.2 5.2h9.6M6.4 5.2V3.6h3.2v1.6M6.6 7.4v3.4M9.4 7.4v3.4" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  fuga_agua: `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 2.2s4.2 4.1 4.2 7a4.2 4.2 0 1 1-8.4 0c0-2.9 4.2-7 4.2-7z" fill="none" stroke="#fff" stroke-width="1.5"/></svg>`,
  drenaje: `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><rect x="2.4" y="3.4" width="11.2" height="9.2" rx="1.2" fill="none" stroke="#fff" stroke-width="1.4"/><path d="M5.2 3.4v9.2M8 3.4v9.2M10.8 3.4v9.2" stroke="#fff" stroke-width="1.2"/></svg>`,
  arbol_caido: `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 13.2V8.2M4.8 8.4 8 3.2l3.2 5.2H4.8z" fill="none" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/><path d="M3 13.2h10" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  otro: `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="5.2" fill="none" stroke="#fff" stroke-width="1.5"/><path d="M8 5v3.5M8 11h.01" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>`,
};

const icons = new Map<string, L.DivIcon>();

function markerIcon(report: Report, selected: boolean, fresh: boolean) {
  const key = `${report.category}-${report.status}-${selected}-${fresh}`;
  const cached = icons.get(key);
  if (cached) return cached;

  const icon = L.divIcon({
    className: "admin-pin",
    html: `<div class="admin-marker${selected ? " is-selected" : ""}${fresh ? " is-fresh" : ""}" style="background:${statusColors[report.status]};width:44px;height:44px">${categoryGlyphs[report.category]}</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
  icons.set(key, icon);
  return icon;
}

function mapIsReady(map: L.Map) {
  const container = map.getContainer();
  return Boolean(container?.isConnected && map.getPane("mapPane"));
}

function FocusSelected({ report }: { report: Report | null }) {
  const map = useMap();
  const lastId = useRef<string | null>(null);

  useEffect(() => {
    if (!report || report.id === lastId.current || !mapIsReady(map)) return;
    lastId.current = report.id;
    map.stop();
    map.flyTo([report.lat, report.lng], Math.max(map.getZoom(), 16), {
      duration: 0.6,
    });
  }, [map, report]);

  return null;
}

function RefreshSize() {
  const map = useMap();

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      if (!alive || !mapIsReady(map)) return;
      map.invalidateSize({ animate: false });
    };
    const id = window.setTimeout(refresh, 80);
    return () => {
      alive = false;
      window.clearTimeout(id);
      if (mapIsReady(map)) map.stop();
    };
  }, [map]);

  return null;
}

type AdminMapProps = {
  reports: Report[];
  selectedId: string | null;
  freshId: string | null;
  onSelect: (id: string) => void;
};

export default function AdminMap({
  reports,
  selectedId,
  freshId,
  onSelect,
}: AdminMapProps) {
  const selected = reports.find((report) => report.id === selectedId) ?? null;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const selectHandlers = useMemo(() => {
    const handlers = new Map<string, { click: () => void }>();
    for (const report of reports) {
      handlers.set(report.id, {
        click: () => onSelectRef.current(report.id),
      });
    }
    return handlers;
  }, [reports]);

  return (
    <MapContainer
      center={SAN_SALVADOR}
      zoom={13}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <RefreshSize />
      <FocusSelected report={selected} />
      {reports.map((report) => (
        <Marker
          key={report.id}
          position={[report.lat, report.lng]}
          icon={markerIcon(report, selectedId === report.id, freshId === report.id)}
          title={`${categoryLabels[report.category]}, ${statusLabels[report.status]}, ${report.tracking_code}`}
          alt={`${categoryLabels[report.category]}, ${statusLabels[report.status]}, ${report.tracking_code}`}
          zIndexOffset={selectedId === report.id ? 1000 : 0}
          eventHandlers={selectHandlers.get(report.id)}
        />
      ))}
    </MapContainer>
  );
}
