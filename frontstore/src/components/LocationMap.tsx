"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Custom pin icon — avoids Leaflet's default marker image assets which 404
// when bundled without extra webpack config.
const pinIcon = L.divIcon({
  className: "",
  html: `<div style="width:30px;height:42px;position:relative">
    <svg viewBox="0 0 24 36" width="30" height="42" style="filter:drop-shadow(0 3px 5px rgba(0,0,0,0.35))">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="var(--brand-color, #dc2626)"/>
      <circle cx="12" cy="12" r="5.5" fill="#fff"/>
    </svg>
  </div>`,
  iconSize: [30, 42],
  iconAnchor: [15, 42],
});

function ClickToMove({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMove(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, Math.max(map.getZoom(), 13), { animate: true });
  }, [center, map]);
  return null;
}

interface LocationMapProps {
  /** Marker position (updates as the user clicks/drags). */
  position: [number, number];
  /** Recenter target — only changes for explicit moves (locate me / area pick). */
  center: [number, number];
  onMove: (lat: number, lng: number) => void;
  /** Optional service circles to overlay (one per branch): center lat/lng + radius in km. */
  circle?: { center: [number, number]; radiusKm: number };
  circles?: { center: [number, number]; radiusKm: number }[];
}

export default function LocationMap({ position, center, onMove, circle, circles }: LocationMapProps) {
  return (
    <MapContainer
      center={center}
      zoom={11}
      scrollWheelZoom
      className="h-full w-full"
      style={{ minHeight: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickToMove onMove={onMove} />
      <Recenter center={center} />
      {circle && circle.radiusKm > 0 && (
        <Circle
          center={circle.center}
          radius={circle.radiusKm * 1000}
          pathOptions={{ color: "#dc2626", weight: 1.5, fillOpacity: 0.08, dashArray: "6 4" }}
        />
      )}
      {(circles ?? []).map((c, i) => c.radiusKm > 0 && (
        <Circle
          key={i}
          center={c.center}
          radius={c.radiusKm * 1000}
          pathOptions={{ color: "#dc2626", weight: 1.5, fillOpacity: 0.08, dashArray: "6 4" }}
        />
      ))}
      <Marker
        position={position}
        icon={pinIcon}
        draggable
        eventHandlers={{
          dragend: (e) => {
            const ll = (e.target as L.Marker).getLatLng();
            onMove(ll.lat, ll.lng);
          },
        }}
      />
    </MapContainer>
  );
}
