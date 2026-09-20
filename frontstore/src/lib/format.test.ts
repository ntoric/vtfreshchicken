import { describe, it, expect } from "vitest";
import { getCurrencySymbol, formatPrice } from "@/lib/format";
import type { Currency } from "@/types";

const usd: Currency = {
  id: "1",
  code: "USD",
  name: "US Dollar",
  symbol: "$",
  decimals: 2,
  is_active: true,
};

const eur: Currency = {
  id: "2",
  code: "EUR",
  name: "Euro",
  symbol: "€",
  decimals: 2,
  is_active: true,
};

const jpy: Currency = {
  id: "3",
  code: "JPY",
  name: "Japanese Yen",
  symbol: "¥",
  decimals: 0,
  is_active: true,
};

const custom: Currency = {
  id: "4",
  code: "ZZZ", // not a real ISO currency
  name: "Custom",
  symbol: "★",
  decimals: 3,
  is_active: true,
};

describe("getCurrencySymbol", () => {
  it("finds a currency by code", () => {
    expect(getCurrencySymbol([usd, eur, jpy], "USD")).toEqual(usd);
    expect(getCurrencySymbol([usd, eur, jpy], "EUR")).toEqual(eur);
  });

  it("returns undefined when not found", () => {
    expect(getCurrencySymbol([usd, eur], "GBP")).toBeUndefined();
  });

  it("returns undefined for empty list", () => {
    expect(getCurrencySymbol([], "USD")).toBeUndefined();
  });

  it("is case-sensitive", () => {
    expect(getCurrencySymbol([usd], "usd")).toBeUndefined();
  });
});

describe("formatPrice", () => {
  it("falls back to USD when no currency provided", () => {
    const out = formatPrice(12.5);
    expect(out).toContain("12.50");
    expect(out).toContain("$");
  });

  it("formats USD with 2 decimals", () => {
    expect(formatPrice(12.5, usd)).toBe("$12.50");
  });

  it("formats zero", () => {
    expect(formatPrice(0, usd)).toBe("$0.00");
  });

  it("formats negative amounts", () => {
    expect(formatPrice(-3.25, eur)).toBe("-€3.25");
  });

  it("respects decimals setting (JPY 0 decimals)", () => {
    expect(formatPrice(1500, jpy)).toBe("¥1,500");
  });

  it("respects decimals setting (3 decimals)", () => {
    // Use a currency with 3 decimals that Intl recognizes (BHD is a 3-decimal currency)
    const bhd: Currency = { id: "5", code: "BHD", name: "Bahraini Dinar", symbol: "BHD", decimals: 3, is_active: true };
    const out = formatPrice(1.234, bhd);
    expect(out).toContain("1.234");
  });

  it("uses custom symbol for non-ISO currency", () => {
    // Empty code triggers the Intl fallback path which uses the admin-provided symbol
    const noCode: Currency = { ...custom, code: "" };
    expect(formatPrice(99.999, noCode)).toBe("★99.999");
  });

  it("formats large amounts with thousands separator", () => {
    expect(formatPrice(1234567.89, usd)).toBe("$1,234,567.89");
  });

  it("handles undefined currency code by falling back to symbol", () => {
    const noCode: Currency = { ...usd, code: "" };
    // Intl will throw on empty currency code, so it falls back to symbol path
    const out = formatPrice(5.5, noCode);
    expect(out).toContain("5.50");
  });
});
