import type { Currency } from "@/types";

export function getCurrencySymbol(currencies: Currency[], code: string): Currency | undefined {
  return currencies.find((c) => c.code === code);
}

export function formatPrice(amount: number, currency?: Currency): string {
  if (!currency) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  }
  const decimals = currency.decimals ?? 2;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.code,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  } catch {
    // Fallback for currencies not recognised by Intl — use the admin-provided symbol
    const formatted = amount.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return `${currency.symbol || ""}${formatted}`;
  }
}
