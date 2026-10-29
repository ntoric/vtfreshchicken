import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, LocateFixed, MapPin, Search } from "lucide-react";

// Custom pin icon — avoids Leaflet's default marker image assets which 404
// when bundled without extra config (same approach as the frontstore map).
const pinIcon = L.divIcon({
  className: "",
  html: `<div style="width:30px;height:42px;position:relative">
    <svg viewBox="0 0 24 36" width="30" height="42" style="filter:drop-shadow(0 3px 5px rgba(0,0,0,0.35))">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="#dc2626"/>
      <circle cx="12" cy="12" r="5.5" fill="#fff"/>
    </svg>
  </div>`,
  iconSize: [30, 42],
  iconAnchor: [15, 42],
});

interface NominatimAddress {
  road?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  country?: string;
  postcode?: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
  class?: string;
  address?: NominatimAddress;
}

export interface PlaceSelection {
  lat: number;
  lng: number;
  label: string;
  type?: string;
  line1?: string;
  city?: string;
  state?: string;
  country?: string;
  postcode?: string;
}

// Forward-geocode a place/building/address via OpenStreetMap Nominatim and
// return the candidate list so the user can pick the right one.
async function searchPlaces(q: string): Promise<PlaceSelection[]> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=1&accept-language=en&q=${encodeURIComponent(q)}`
    );
    if (!res.ok) return [];
    const data: NominatimResult[] = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .map((r) => {
        const a = r.address ?? {};
        return {
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
          label: r.display_name,
          type: r.type,
          line1: [a.road, a.suburb || a.neighbourhood].filter(Boolean).join(", ") || undefined,
          city: a.city || a.town || a.village || a.county,
          state: a.state,
          country: a.country,
          postcode: a.postcode,
        };
      })
      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
  } catch {
    return [];
  }
}

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

interface ServiceAreaMapPickerProps {
  lat: number;
  lng: number;
  radiusKm: number;
  /** Inner delivery-zone ring radii (km) previewed as lighter dashed circles. */
  innerRings?: number[];
  /** Fired whenever the center coordinate changes (map click, pin drag, locate me, search select). */
  onPick: (lat: number, lng: number) => void;
  /** Fired when a search result is selected — carries the full address details. */
  onSelect?: (place: PlaceSelection) => void;
}

export function ServiceAreaMapPicker({ lat, lng, radiusKm, innerRings, onPick, onSelect }: ServiceAreaMapPickerProps) {
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
  // Default view: Malappuram, Kerala — the store's primary market.
  const fallbackCenter: [number, number] = [11.051, 76.0711];
  const position: [number, number] = hasCoords ? [lat, lng] : fallbackCenter;
  const [mapCenter, setMapCenter] = useState<[number, number]>(position);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSelection[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);

  // Debounced place search — lists matching places/addresses to pick from.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setSearched(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = window.setTimeout(async () => {
      const r = await searchPlaces(q);
      setResults(r);
      setSearching(false);
      setSearched(true);
    }, 450);
    return () => window.clearTimeout(t);
  }, [query]);

  // Keep the map centered on the current coordinates (manual input, search, clicks).
  useEffect(() => {
    if (hasCoords) setMapCenter([lat, lng]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  const choose = (p: PlaceSelection) => {
    onPick(p.lat, p.lng);
    onSelect?.(p);
    setMapCenter([p.lat, p.lng]);
    setQuery("");
    setResults([]);
    setSearched(false);
  };

  const locateMe = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        onPick(p.coords.latitude, p.coords.longitude);
        setMapCenter([p.coords.latitude, p.coords.longitude]);
        setGeoBusy(false);
      },
      () => setGeoBusy(false),
      { timeout: 10000, maximumAge: 60000 }
    );
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a place, building or address…"
          className="w-full border rounded-lg pl-9 pr-9 py-2 text-sm"
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-neutral-400" />}

        {(results.length > 0 || (searched && !searching)) && (
          <div className="absolute left-0 right-0 top-full mt-1 z-[1000] bg-white border rounded-xl shadow-lg max-h-64 overflow-y-auto">
            {results.map((r, i) => (
              <button
                key={`${r.lat}-${r.lng}-${i}`}
                type="button"
                onClick={() => choose(r)}
                className="w-full text-left px-3 py-2.5 hover:bg-neutral-50 border-b last:border-b-0 flex items-start gap-2"
              >
                <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-neutral-400" />
                <span className="min-w-0">
                  <span className="block text-sm text-neutral-800 line-clamp-2">{r.label}</span>
                  <span className="block text-xs text-neutral-400 mt-0.5">
                    {[r.type, r.city, r.state, r.country].filter(Boolean).join(" · ")}
                    {` — ${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}`}
                  </span>
                </span>
              </button>
            ))}
            {results.length === 0 && (
              <p className="px-3 py-3 text-sm text-neutral-400">No matches found — try a different name or drop the pin on the map.</p>
            )}
          </div>
        )}
      </div>

      <div className="relative rounded-xl overflow-hidden border">
        <div className="h-72">
          <MapContainer center={mapCenter} zoom={hasCoords ? 13 : 9} scrollWheelZoom className="h-full w-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickToMove onMove={onPick} />
            <Recenter center={mapCenter} />
            {hasCoords && radiusKm > 0 && (
              <Circle
                center={position}
                radius={radiusKm * 1000}
                pathOptions={{ color: "#dc2626", weight: 1.5, fillOpacity: 0.08, dashArray: "6 4" }}
              />
            )}
            {hasCoords && (innerRings ?? []).filter((r) => r > 0 && r < radiusKm).map((r) => (
              <Circle
                key={r}
                center={position}
                radius={r * 1000}
                pathOptions={{ color: "#f59e0b", weight: 1, fillOpacity: 0.04, dashArray: "3 4" }}
              />
            ))}
            {hasCoords && (
              <Marker
                position={position}
                icon={pinIcon}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const ll = (e.target as L.Marker).getLatLng();
                    onPick(ll.lat, ll.lng);
                  },
                }}
              />
            )}
          </MapContainer>
        </div>
        <button
          type="button"
          onClick={locateMe}
          disabled={geoBusy}
          className="absolute top-3 right-3 z-[500] inline-flex items-center gap-1.5 bg-white rounded-full shadow-lg border px-3.5 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
        >
          {geoBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LocateFixed className="w-3.5 h-3.5 text-brand" />}
          {geoBusy ? "Detecting…" : "Use my location"}
        </button>
      </div>

      <p className="text-xs text-neutral-400">
        Search for a place above, click the map, or drag the pin — or enter the coordinates manually below.
        {radiusKm > 0 ? " The dashed circle previews the delivery radius." : ""}
      </p>
    </div>
  );
}
