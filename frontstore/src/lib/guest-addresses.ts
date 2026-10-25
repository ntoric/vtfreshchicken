import type { AddressInput } from "@/types";

// Delivery addresses for anonymous (guest) shoppers are kept in localStorage
// so a returning guest can pick a previous address instead of re-typing it.
// Authenticated users use server-side saved addresses instead.
export const GUEST_ADDRESSES_KEY = "tc_guest_addresses";
const MAX_GUEST_ADDRESSES = 5;

export interface GuestAddress extends AddressInput {
  id: string;
  /** epoch ms — most recently used address sorts first */
  updated_at: number;
}

function normalize(s?: string): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

// Two entries are "the same address" when the delivery fields match —
// email is excluded so a repeat order with a different email updates the
// existing entry instead of duplicating it.
function addressKey(a: AddressInput): string {
  return [
    normalize(a.first_name),
    normalize(a.last_name),
    normalize(a.line1),
    normalize(a.line2),
    normalize(a.city),
    normalize(a.phone),
  ].join("|");
}

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `ga-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isGuestAddress(v: unknown): v is GuestAddress {
  if (!v || typeof v !== "object") return false;
  const a = v as GuestAddress;
  return typeof a.id === "string" && typeof a.line1 === "string";
}

export function loadGuestAddresses(): GuestAddress[] {
  try {
    const raw = localStorage.getItem(GUEST_ADDRESSES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isGuestAddress)
      .sort((x, y) => (y.updated_at ?? 0) - (x.updated_at ?? 0))
      .slice(0, MAX_GUEST_ADDRESSES);
  } catch {
    return [];
  }
}

function write(list: GuestAddress[]): GuestAddress[] {
  try {
    localStorage.setItem(GUEST_ADDRESSES_KEY, JSON.stringify(list));
  } catch {
    // ignore storage errors (e.g. private browsing)
  }
  return list;
}

/** Insert or bump an address to the front of the guest address book. */
export function saveGuestAddress(addr: AddressInput): GuestAddress[] {
  const key = addressKey(addr);
  const rest = loadGuestAddresses().filter((a) => addressKey(a) !== key);
  const next: GuestAddress = { ...addr, id: newId(), updated_at: Date.now() };
  return write([next, ...rest].slice(0, MAX_GUEST_ADDRESSES));
}

export function removeGuestAddress(id: string): GuestAddress[] {
  return write(loadGuestAddresses().filter((a) => a.id !== id));
}

export function clearGuestAddresses(): void {
  try {
    localStorage.removeItem(GUEST_ADDRESSES_KEY);
  } catch {
    // ignore storage errors
  }
}
