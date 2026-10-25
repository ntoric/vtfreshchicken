"use client";

import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { useBootstrap } from "@/lib/bootstrap";
import type { Branch, ServiceArea } from "@/types";

// Fallback launch area (Malappuram district, Kerala) — used only when the
// store has no branches or service_area configured in the backoffice.
const DEFAULT_SERVICE_AREA: ServiceArea = {
  enabled: true,
  label: "Malappuram district, Kerala",
  state: "Kerala",
  country: "India",
  center_lat: 11.051,
  center_lng: 76.071,
  radius_km: 50,
  areas: [
    "Malappuram", "Manjeri", "Perinthalmanna", "Tirur", "Tirurangadi",
    "Parappanangadi", "Tanur", "Ponnani", "Kottakkal", "Valanchery",
    "Kondotty", "Kuttippuram", "Edappal", "Changaramkulam", "Chemmad",
    "Vengara", "Puthanathani", "Kalpakanchery", "Kolathur", "Pulamanthole",
    "Nilambur", "Wandoor", "Areekode", "Edavanna", "Vaniyambalam",
    "Mankada", "Melattur", "Pandikkad", "Karuvarakundu",
  ],
};

/** Great-circle distance in kilometres between two lat/lng points. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Location preference is kept in session storage (per browsing session).
const STORAGE_KEY = "tc_delivery_area";
const PROMPTED_KEY = "tc_location_prompted";

function storeGet(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function storeSet(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // ignore storage errors
  }
}

// One-time migration of preferences saved in localStorage by an earlier version.
function migrateLegacy(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PROMPTED_KEY);
    return raw;
  } catch {
    return null;
  }
}

export interface AreaGroup {
  /** Group label — the branch name, or the service-area label. */
  label: string;
  branch_id?: string;
  areas: string[];
}

export interface LocationState {
  /** Selected town/area, or null when nothing is chosen yet. */
  area: string | null;
  /** False when the user picked an area we don't deliver to. */
  serviceable: boolean;
  /** Active service-area config (legacy store-level fallback). */
  config: ServiceArea;
  /** Active branches with service areas (empty = legacy single-area mode). */
  branches: Branch[];
  /** Named areas grouped by branch for the picker list. */
  areaGroups: AreaGroup[];
  /** Branch that will fulfil the current selection, when known. */
  branch: Branch | null;
  /** Coordinates of the selection when picked on the map. */
  lat: number | null;
  lng: number | null;
  pickerOpen: boolean;
  setArea: (area: string, serviceable?: boolean, meta?: { lat?: number; lng?: number; branch?: Branch | null }) => void;
  openPicker: () => void;
  closePicker: () => void;
  /** True when the point is inside any branch's (or the legacy) service circle. */
  isPointServiceable: (lat: number, lng: number) => boolean;
  /** True when a named area matches any branch's (or the legacy) area list. */
  isAreaServiceable: (name: string) => boolean;
  /** Nearest branch whose circle covers the point. */
  branchForPoint: (lat: number, lng: number) => Branch | null;
  /** Branch whose named-area list contains the name. */
  branchForArea: (name: string) => Branch | null;
}

const Ctx = createContext<LocationState | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const bootstrap = useBootstrap();
  const config = bootstrap?.settings.service_area ?? DEFAULT_SERVICE_AREA;
  const branches = useMemo(() => bootstrap?.branches ?? [], [bootstrap?.branches]);
  const [area, setAreaState] = useState<string | null>(null);
  const [serviceable, setServiceable] = useState(true);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const hasBranches = branches.length > 0;

  // Named areas grouped per branch; legacy mode yields a single group.
  const areaGroups = useMemo<AreaGroup[]>(() => {
    if (hasBranches) {
      return branches
        .filter((b) => (b.areas?.length ?? 0) > 0)
        .map((b) => ({ label: b.name, branch_id: b.id, areas: b.areas ?? [] }));
    }
    return [{ label: config.label, areas: config.areas }];
  }, [branches, hasBranches, config.label, config.areas]);

  const areaSet = useMemo(
    () => new Set(branches.flatMap((b) => b.areas ?? []).concat(hasBranches ? [] : config.areas).map((a) => a.toLowerCase())),
    [branches, hasBranches, config.areas],
  );

  const isAreaServiceable = useCallback(
    (name: string) => {
      if (!hasBranches && !config.enabled) return true;
      return areaSet.has(name.trim().toLowerCase());
    },
    [hasBranches, config.enabled, areaSet],
  );

  const branchForPoint = useCallback(
    (la: number, ln: number): Branch | null => {
      let best: Branch | null = null;
      let bestDist = Infinity;
      for (const b of branches) {
        if (b.radius_km <= 0) continue;
        const d = haversineKm(la, ln, b.center_lat, b.center_lng);
        if (d <= b.radius_km && d < bestDist) {
          bestDist = d;
          best = b;
        }
      }
      return best;
    },
    [branches],
  );

  const branchForArea = useCallback(
    (name: string): Branch | null => {
      const n = name.trim().toLowerCase();
      return branches.find((b) => (b.areas ?? []).some((a) => a.toLowerCase() === n)) ?? null;
    },
    [branches],
  );

  const isPointServiceable = useCallback(
    (la: number, ln: number) => {
      if (hasBranches) return branchForPoint(la, ln) !== null;
      if (!config.enabled) return true;
      if (config.radius_km <= 0) return false;
      return haversineKm(la, ln, config.center_lat, config.center_lng) <= config.radius_km;
    },
    [hasBranches, branchForPoint, config.enabled, config.center_lat, config.center_lng, config.radius_km],
  );

  // Hydrate saved location; prompt once per session when nothing is chosen
  useEffect(() => {
    const raw = storeGet(STORAGE_KEY) ?? migrateLegacy();
    if (raw) {
      try {
        const d = JSON.parse(raw) as { area?: string; serviceable?: boolean; lat?: number; lng?: number; branch_id?: string };
        if (d.area) {
          setAreaState(d.area);
          setServiceable(d.serviceable !== false);
          if (typeof d.lat === "number") setLat(d.lat);
          if (typeof d.lng === "number") setLng(d.lng);
          if (d.branch_id) setBranch(branches.find((b) => b.id === d.branch_id) ?? null);
          return;
        }
      } catch {
        // fall through to the prompt
      }
    }
    if (!storeGet(PROMPTED_KEY)) {
      setPickerOpen(true);
      storeSet(PROMPTED_KEY, "1");
    }
  }, [branches]);

  const setArea = useCallback((next: string, ok = true, meta?: { lat?: number; lng?: number; branch?: Branch | null }) => {
    setAreaState(next);
    setServiceable(ok);
    const la = meta?.lat ?? null;
    const ln = meta?.lng ?? null;
    const br = meta?.branch ?? null;
    setLat(la);
    setLng(ln);
    setBranch(br);
    setPickerOpen(false);
    storeSet(STORAGE_KEY, JSON.stringify({ area: next, serviceable: ok, lat: la, lng: ln, branch_id: br?.id ?? null }));
  }, []);

  const openPicker = useCallback(() => setPickerOpen(true), []);
  const closePicker = useCallback(() => setPickerOpen(false), []);

  return (
    <Ctx.Provider value={{
      area, serviceable, config, branches, areaGroups, branch, lat, lng, pickerOpen,
      setArea, openPicker, closePicker, isPointServiceable, isAreaServiceable, branchForPoint, branchForArea,
    }}>
      {children}
    </Ctx.Provider>
  );
}

const FALLBACK: LocationState = {
  area: null,
  serviceable: true,
  config: DEFAULT_SERVICE_AREA,
  branches: [],
  areaGroups: [],
  branch: null,
  lat: null,
  lng: null,
  pickerOpen: false,
  setArea: () => {},
  openPicker: () => {},
  closePicker: () => {},
  isPointServiceable: () => true,
  isAreaServiceable: () => true,
  branchForPoint: () => null,
  branchForArea: () => null,
};

export function useLocation(): LocationState {
  return useContext(Ctx) ?? FALLBACK;
}
