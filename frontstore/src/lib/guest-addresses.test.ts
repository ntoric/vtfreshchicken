import { describe, it, expect, beforeEach } from "vitest";
import {
  GUEST_ADDRESSES_KEY,
  loadGuestAddresses,
  saveGuestAddress,
  removeGuestAddress,
  clearGuestAddresses,
} from "@/lib/guest-addresses";
import type { AddressInput } from "@/types";

const base: AddressInput = {
  first_name: "Ammu",
  last_name: "K",
  email: "ammu@example.com",
  line1: "Rose Villa, Hill Road",
  city: "Manjeri",
  state: "Kerala",
  country: "India",
  phone: "+91 9800000000",
};

describe("guest addresses", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns [] when nothing stored", () => {
    expect(loadGuestAddresses()).toEqual([]);
  });

  it("returns [] for malformed JSON", () => {
    localStorage.setItem(GUEST_ADDRESSES_KEY, "not-json");
    expect(loadGuestAddresses()).toEqual([]);
  });

  it("returns [] for non-array payload", () => {
    localStorage.setItem(GUEST_ADDRESSES_KEY, JSON.stringify({ id: "x" }));
    expect(loadGuestAddresses()).toEqual([]);
  });

  it("saves an address and reloads it", () => {
    saveGuestAddress(base);
    const list = loadGuestAddresses();
    expect(list).toHaveLength(1);
    expect(list[0].line1).toBe(base.line1);
    expect(list[0].id).toBeTruthy();
    expect(list[0].updated_at).toBeGreaterThan(0);
  });

  it("dedupes the same address and moves it to the front", () => {
    saveGuestAddress(base);
    saveGuestAddress({ ...base, line1: "Other House" });
    saveGuestAddress(base);
    const list = loadGuestAddresses();
    expect(list).toHaveLength(2);
    expect(list[0].line1).toBe(base.line1);
    expect(list[1].line1).toBe("Other House");
  });

  it("dedupes case- and whitespace-insensitively", () => {
    saveGuestAddress(base);
    saveGuestAddress({ ...base, line1: "  rose villa, hill road " });
    expect(loadGuestAddresses()).toHaveLength(1);
  });

  it("does not dupe when only the email differs", () => {
    saveGuestAddress(base);
    saveGuestAddress({ ...base, email: "other@example.com" });
    const list = loadGuestAddresses();
    expect(list).toHaveLength(1);
    expect(list[0].email).toBe("other@example.com");
  });

  it("caps the list at 5 entries, most recent first", () => {
    for (let i = 0; i < 7; i++) {
      saveGuestAddress({ ...base, line1: `House ${i}` });
    }
    const list = loadGuestAddresses();
    expect(list).toHaveLength(5);
    expect(list[0].line1).toBe("House 6");
    expect(list[4].line1).toBe("House 2");
  });

  it("removeGuestAddress deletes only the matching entry", () => {
    saveGuestAddress(base);
    const second = saveGuestAddress({ ...base, line1: "Other House" });
    const remaining = removeGuestAddress(second[1].id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].line1).toBe("Other House");
    expect(loadGuestAddresses()).toHaveLength(1);
  });

  it("clearGuestAddresses empties the store", () => {
    saveGuestAddress(base);
    clearGuestAddresses();
    expect(loadGuestAddresses()).toEqual([]);
    expect(localStorage.getItem(GUEST_ADDRESSES_KEY)).toBeNull();
  });
});
