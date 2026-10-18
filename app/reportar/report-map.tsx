"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const SAN_SALVADOR: [number, number] = [13.6989, -89.2182];

const pinIcon = L.divIcon({
  className: "report-pin",
  html: `<svg width="44" height="58" viewBox="0 0 32 42" aria-hidden="true">
    <path fill="#3d6fe0" d="M16 0C7.2 0 0 7.2 0 16c0 12 16 26 16 26s16-14 16-26C32 7.2 24.8 0 16 0z"/>
    <circle cx="16" cy="16" r="6" fill="#fff"/>
  </svg>`,
  iconSize: [44, 58],
  iconAnchor: [22, 58],
});

type ReportMapProps = {
  lat: number | null;
  lng: number | null;
  focusKey: number;
  onPick: (lat: number, lng: number) => void;
};

function MapClicks({ onPick }: { onPick: ReportMapProps["onPick"] }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function mapIsReady(map: L.Map) {
  const container = map.getContainer();
  return Boolean(container?.isConnected && map.getPane("mapPane"));
}

function FocusOnPoint({
  lat,
  lng,
  focusKey,
}: {
  lat: number;
  lng: number;
  focusKey: number;
}) {
  const map = useMap();
  const lastFocus = useRef(0);

  useEffect(() => {
    if (focusKey === 0 || focusKey === lastFocus.current || !mapIsReady(map)) return;
    lastFocus.current = focusKey;
    map.stop();
    map.setView([lat, lng], 17);
  }, [focusKey, lat, lng, map]);

  return null;
}

function ResetView({ active }: { active: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!active || !mapIsReady(map)) return;
    map.stop();
    map.setView(SAN_SALVADOR, 13);
  }, [active, map]);

  return null;
}

function RefreshSize() {
  const map = useMap();

  useEffect(() => {
    let alive = true;
    const container = map.getContainer();
    const refresh = () => {
      if (!alive || !mapIsReady(map)) return;
      map.invalidateSize({ animate: false });
    };
    const id = window.setTimeout(refresh, 50);
    const observer = new ResizeObserver(refresh);
    observer.observe(container);
    window.addEventListener("orientationchange", refresh);
    return () => {
      alive = false;
      window.clearTimeout(id);
      observer.disconnect();
      window.removeEventListener("orientationchange", refresh);
      if (mapIsReady(map)) map.stop();
    };
  }, [map]);

  return null;
}

export default function ReportMap({ lat, lng, focusKey, onPick }: ReportMapProps) {
  const hasPoint = lat !== null && lng !== null;
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const markerHandlers = useMemo(
    () => ({
      dragend(event: L.DragEndEvent) {
        const next = event.target.getLatLng();
        onPickRef.current(next.lat, next.lng);
      },
    }),
    [],
  );

  return (
    <MapContainer
      center={hasPoint ? [lat, lng] : SAN_SALVADOR}
      zoom={hasPoint ? 17 : 13}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <RefreshSize />
      <MapClicks onPick={onPick} />
      <ResetView active={!hasPoint} />
      {hasPoint ? <FocusOnPoint lat={lat} lng={lng} focusKey={focusKey} /> : null}
      {hasPoint ? (
        <Marker
          position={[lat, lng]}
          draggable
          autoPan={false}
          icon={pinIcon}
          eventHandlers={markerHandlers}
        />
      ) : null}
    </MapContainer>
  );
}
