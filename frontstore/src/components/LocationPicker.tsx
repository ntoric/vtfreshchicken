"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { MapPin, Search, X, Check, LocateFixed, Loader2, AlertCircle, MapPinOff, Store } from "lucide-react";
import { useLocation, haversineKm } from "@/lib/location";
import { checkDeliveryLocation } from "@/lib/api";
import type { Branch, BranchMatch } from "@/types";

// Leaflet needs window — load the map client-side only.
const LocationMap = dynamic(() => import("@/components/LocationMap"), {
  ssr: false,
  loading: () => (
    <div className="h-64 sm:h-72 grid place-items-center bg-stone-100 text-stone-400 text-sm">
      <Loader2 className="w-5 h-5 animate-spin mr-2 inline-block" /> Loading map…
    </div>
  ),
});

type Mode = "list" | "map";

interface ResolvedArea {
  name: string;
  serviceable: boolean;
}

async function reverseGeocodeName(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=14&accept-language=en`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address || {};
    const name: string =
      a.suburb ||
      a.neighbourhood ||
      a.town ||
      a.village ||
      a.city ||
      a.town_district ||
      a.city_district ||
      a.county ||
      data.name ||
      "";
    return name || null;
  } catch {
    return null;
  }
}

// Forward-geocode a typed place name so it can be checked against the
// service circle even when it isn't in the named area list.
async function geocodeName(name: string): Promise<{ lat: number; lng: number; label: string } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&accept-language=en&q=${encodeURIComponent(name)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: data[0].display_name || name };
  } catch {
    return null;
  }
}

export function LocationPicker() {
  const { area, config, branches, areaGroups, pickerOpen, setArea, closePicker, isPointServiceable, isAreaServiceable, branchForPoint, branchForArea } = useLocation();
  const [mode, setMode] = useState<Mode>("list");
  const [query, setQuery] = useState("");
  const [custom, setCustom] = useState("");
  const hasBranches = branches.length > 0;
  const defaultCenter: [number, number] = hasBranches
    ? [branches.find((b) => b.is_default)?.center_lat ?? branches[0].center_lat, branches.find((b) => b.is_default)?.center_lng ?? branches[0].center_lng]
    : [config.center_lat, config.center_lng];
  const [pinPos, setPinPos] = useState<[number, number]>(defaultCenter);
  const [mapCenter, setMapCenter] = useState<[number, number]>(defaultCenter);
  const [resolved, setResolved] = useState<ResolvedArea | null>(null);
  const [resolving, setResolving] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoErr, setGeoErr] = useState("");
  const [checkingCustom, setCheckingCustom] = useState(false);
  // Eligible branches for the picked point (nearest first) — the nearest is
  // auto-selected, the customer can switch to any other eligible branch.
  const [matches, setMatches] = useState<BranchMatch[]>([]);
  const [selBranchId, setSelBranchId] = useState<string | null>(null);
  // Out-of-service-area alert popup — shown when the user picks a location
  // outside the configured delivery circle.
  const [outOfRange, setOutOfRange] = useState<string | null>(null);

  const selBranch = matches.find((m) => m.branch.id === selBranchId)?.branch ?? matches[0]?.branch ?? null;

  const chooseArea = useCallback(
    (name: string, serviceable: boolean, meta?: { lat?: number; lng?: number; branch?: Branch | null }) => {
      if (!serviceable) {
        setOutOfRange(name);
        return;
      }
      const branch = meta?.branch !== undefined
        ? meta.branch
        : meta?.lat != null && meta?.lng != null
          ? branchForPoint(meta.lat, meta.lng)
          : branchForArea(name);
      setArea(name, true, { lat: meta?.lat, lng: meta?.lng, branch });
    },
    [setArea, branchForPoint, branchForArea],
  );

  // Client-side mirror of the backend check — every branch circle covering
  // the point, nearest first. Used only when the API call fails or the store
  // has no branches configured (legacy service-area mode).
  const clientMatches = useCallback(
    (la: number, ln: number): BranchMatch[] =>
      branches
        .filter((b) => b.radius_km > 0)
        .map((b) => ({ branch: b, distance_km: haversineKm(la, ln, b.center_lat, b.center_lng) }))
        .filter((m) => (m.distance_km ?? Infinity) <= m.branch.radius_km)
        .sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0)),
    [branches],
  );

  // Serviceability check: send the coordinates to the backend, which measures
  // the distance against every branch's service radius and returns all
  // eligible branches (nearest first). Falls back to the equivalent
  // client-side computation when the API is unreachable.
  const checkPoint = useCallback(
    async (la: number, ln: number, areaName: string | null): Promise<{ serviceable: boolean; matches: BranchMatch[] }> => {
      if (hasBranches) {
        try {
          const r = await checkDeliveryLocation({ lat: la, lng: ln, area: areaName ?? undefined });
          return { serviceable: r.serviceable, matches: r.branches ?? [] };
        } catch {
          // fall through to the client-side equivalent
        }
      }
      let matches = clientMatches(la, ln);
      const serviceable = isPointServiceable(la, ln) || (areaName ? isAreaServiceable(areaName) : false);
      if (matches.length === 0 && areaName) {
        const b = branchForArea(areaName);
        if (b) matches = [{ branch: b }];
      }
      return { serviceable, matches };
    },
    [hasBranches, clientMatches, isPointServiceable, isAreaServiceable, branchForArea],
  );

  const onMapMove = useCallback((lat: number, lng: number) => {
    setPinPos([lat, lng]);
    setResolving(true);
    reverseGeocodeName(lat, lng).then(async (name) => {
      const chk = await checkPoint(lat, lng, name);
      setResolved({ name: name ?? "Pinned location", serviceable: chk.serviceable });
      setMatches(chk.matches);
      setSelBranchId(chk.matches[0]?.branch.id ?? null);
      setResolving(false);
    });
  }, [checkPoint]);

  const locateMe = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoErr("Location detection isn't supported on this device.");
      return;
    }
    setGeoBusy(true);
    setGeoErr("");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos: [number, number] = [p.coords.latitude, p.coords.longitude];
        setMapCenter(pos);
        onMapMove(pos[0], pos[1]);
        setGeoBusy(false);
      },
      () => {
        setGeoErr("Couldn't detect your location — drop the pin instead.");
        setGeoBusy(false);
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }, [onMapMove]);

  // Confirm a typed custom area: name match wins, otherwise forward-geocode
  // and check the coordinates against the service circle.
  const submitCustom = useCallback(async (value: string) => {
    const v = value.trim();
    if (!v) return;
    if (isAreaServiceable(v)) {
      setArea(v, true, { branch: branchForArea(v) });
      return;
    }
    setCheckingCustom(true);
    const hit = await geocodeName(v);
    const chk = hit ? await checkPoint(hit.lat, hit.lng, v) : { serviceable: false, matches: [] as BranchMatch[] };
    setCheckingCustom(false);
    if (hit && chk.serviceable) {
      setArea(v, true, { lat: hit.lat, lng: hit.lng, branch: chk.matches[0]?.branch ?? null });
      return;
    }
    setOutOfRange(v);
  }, [isAreaServiceable, setArea, branchForArea, checkPoint]);

  if (!pickerOpen) return null;

  const q = query.trim().toLowerCase();
  const groups = q
    ? areaGroups.map((g) => ({ ...g, areas: g.areas.filter((a) => a.toLowerCase().includes(q)) })).filter((g) => g.areas.length > 0)
    : areaGroups;
  const totalAreas = groups.reduce((n, g) => n + g.areas.length, 0);
  const circles = hasBranches
    ? branches.filter((b) => b.radius_km > 0).map((b) => ({ center: [b.center_lat, b.center_lng] as [number, number], radiusKm: b.radius_km }))
    : config.enabled && config.radius_km > 0
      ? [{ center: defaultCenter, radiusKm: config.radius_km }]
      : [];

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
        onClick={closePicker}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose your delivery area"
        className="fixed inset-x-3 top-[6vh] sm:inset-x-0 sm:mx-auto sm:max-w-md z-[61] bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden"
      >
        <div className="flex items-start justify-between p-5 pb-4 border-b border-stone-100">
          <div>
            <h2 className="font-display text-xl font-semibold text-stone-900">
              Choose your delivery area
            </h2>
            <p className="text-xs text-stone-500 mt-1">
              Select where your order should be delivered.
            </p>
          </div>
          <button
            onClick={closePicker}
            className="p-2 -mr-2 -mt-1 rounded-lg hover:bg-stone-100 text-stone-500"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode tabs — list vs map, like food-delivery pickers */}
        <div className="flex gap-2 px-4 pt-4">
          {(
            [
              ["list", "Choose from list"],
              ["map", "Pick on map"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                mode === m
                  ? "bg-brand text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {mode === "list" ? (
            <>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  type="search"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search your town or area…"
                  className="w-full pl-10 pr-4 py-2.5 rounded-full bg-stone-100 border border-transparent text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:bg-white focus:border-stone-300 transition-all"
                />
              </div>

              <div className="mt-3 max-h-72 overflow-y-auto">
                {groups.map((g) => (
                  <div key={g.label || "areas"}>
                    {hasBranches && g.label && (
                      <p className="px-2 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                        {g.label}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-1.5">
                      {g.areas.map((a) => {
                        const selected = a === area;
                        return (
                          <button
                            key={a}
                            onClick={() => chooseArea(a, true)}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-left transition-colors ${
                              selected
                                ? "bg-brand-light text-brand font-semibold"
                                : "text-stone-700 hover:bg-stone-100"
                            }`}
                          >
                            <MapPin className={`w-3.5 h-3.5 shrink-0 ${selected ? "text-brand" : "text-stone-400"}`} />
                            <span className="truncate">{a}</span>
                            {selected && <Check className="w-3.5 h-3.5 ml-auto shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {totalAreas === 0 && (
                  <p className="text-sm text-stone-400 text-center py-4">
                    No matching area in our delivery list.
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Map mode — click or drag the pin, or auto-detect */}
              <div className="relative rounded-2xl overflow-hidden border border-stone-200">
                <div className="h-64 sm:h-72">
                  <LocationMap position={pinPos} center={mapCenter} onMove={onMapMove} circles={circles} />
                </div>
                <button
                  onClick={locateMe}
                  disabled={geoBusy}
                  className="absolute top-3 right-3 z-[500] inline-flex items-center gap-1.5 bg-white rounded-full shadow-lg border border-stone-200 px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors disabled:opacity-60"
                >
                  {geoBusy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <LocateFixed className="w-3.5 h-3.5 text-brand" />
                  )}
                  {geoBusy ? "Detecting…" : "Use my location"}
                </button>
              </div>

              {geoErr && (
                <p className="flex items-center gap-1.5 text-xs text-amber-600 mt-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {geoErr}
                </p>
              )}

              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-[#faf7f1] px-4 py-3">
                <div className="flex items-center gap-2 text-sm min-w-0">
                  <MapPin className={`w-4 h-4 shrink-0 ${resolved?.serviceable ? "text-brand" : "text-stone-400"}`} />
                  {resolving ? (
                    <span className="text-stone-500">Locating area…</span>
                  ) : resolved ? (
                    <span className="truncate text-stone-800">
                      <strong>{resolved.name}</strong>
                      {resolved.serviceable ? (
                        <span className="text-emerald-600 text-xs ml-1.5">delivery available</span>
                      ) : (
                        <span className="text-rose-500 text-xs ml-1.5">outside delivery area</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-stone-500">Tap the map or drag the pin</span>
                  )}
                </div>
                <button
                  onClick={() => resolved && chooseArea(resolved.name, resolved.serviceable, { lat: pinPos[0], lng: pinPos[1], branch: selBranch })}
                  disabled={!resolved || resolving}
                  className="shrink-0 rounded-full bg-brand text-white text-xs font-semibold px-4 py-2 hover:bg-brand-dark transition-colors disabled:opacity-40"
                >
                  Confirm
                </button>
              </div>

              {/* Fulfilling branch — nearest eligible is auto-selected; tap
                  another eligible branch to switch when more than one serves
                  the location. */}
              {resolved?.serviceable && matches.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-xs text-stone-500">
                    <Store className="w-3.5 h-3.5" /> Fulfilled by
                  </span>
                  {matches.map((m) => {
                    const active = (selBranch?.id ?? matches[0].branch.id) === m.branch.id;
                    return (
                      <button
                        key={m.branch.id}
                        onClick={() => setSelBranchId(m.branch.id)}
                        disabled={matches.length === 1}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                          active
                            ? "bg-brand text-white"
                            : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                        }`}
                      >
                        {m.branch.name}
                        {m.distance_km != null && <span className={active ? "text-white/80" : "text-stone-400"}>{` · ${m.distance_km.toFixed(1)} km`}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          <form
            className="mt-4 pt-4 border-t border-stone-100"
            onSubmit={(e) => {
              e.preventDefault();
              submitCustom(custom);
            }}
          >
            <p className="text-xs font-medium text-stone-600 mb-2">
              Can&apos;t find your area?
            </p>
            <div className="flex gap-2">
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Enter your town / area"
                className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl bg-stone-100 border border-transparent text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:bg-white focus:border-stone-300 transition-all"
              />
              <button
                type="submit"
                disabled={!custom.trim() || checkingCustom}
                className="px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition-colors disabled:opacity-40 inline-flex items-center gap-1.5"
              >
                {checkingCustom && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Set
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Out-of-range alert popup */}
      {outOfRange && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[70]" onClick={() => setOutOfRange(null)} aria-hidden />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Delivery not available"
            className="fixed inset-x-6 top-1/2 -translate-y-1/2 sm:inset-x-0 sm:mx-auto sm:max-w-sm z-[71] bg-white rounded-2xl shadow-2xl border border-stone-200 p-6 text-center animate-fade-in-up"
          >
            <div className="mx-auto w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center mb-3">
              <MapPinOff className="w-7 h-7 text-rose-500" strokeWidth={1.75} />
            </div>
            <h3 className="text-lg font-bold text-stone-900">Delivery not available</h3>
            <p className="text-sm text-stone-500 mt-2 leading-relaxed">
              Sorry, we don&apos;t deliver to <strong className="text-stone-800">{outOfRange}</strong> yet.
              {config.label ? ` We currently serve ${config.label}.` : ""}
            </p>
            <button
              onClick={() => setOutOfRange(null)}
              className="mt-5 w-full rounded-xl bg-brand text-white text-sm font-semibold px-4 py-2.5 hover:bg-brand-dark transition-colors"
            >
              Choose another area
            </button>
          </div>
        </>
      )}
    </>
  );
}
