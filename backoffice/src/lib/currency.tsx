import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Currency } from "@/types";

const FALLBACK: Currency = {
  id: "",
  code: "USD",
  name: "US Dollar",
  symbol: "$",
  decimals: 2,
  is_active: true,
  rate: 1,
};

interface CurrencyCtx {
  /** The store's configured default currency. */
  currency: Currency;
  currencies: Currency[];
  /** Convert `amount` expressed in `fromCode` into the configured currency. */
  convert: (amount: number, fromCode?: string) => number;
  /**
   * Convert `amount` expressed in `fromCode` (default: the configured
   * currency) into the configured currency and format it with its
   * code/symbol/decimals.
   */
  formatMoney: (amount: number, fromCode?: string) => string;
}

const Ctx = createContext<CurrencyCtx | null>(null);

function rateOf(c: Currency | undefined): number {
  return c?.rate && c.rate > 0 ? c.rate : 1;
}

function formatAmount(amount: number, currency: Currency): string {
  const decimals = currency.decimals ?? 2;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.code,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  } catch {
    // Fallback for codes Intl doesn't recognise — use the configured symbol.
    return `${currency.symbol || ""}${amount.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  }
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { user, tenant } = useAuth();

  const settingsQ = useQuery({
    queryKey: ["settings", tenant],
    queryFn: () => api.getSettings(tenant),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
  const currenciesQ = useQuery({
    queryKey: ["currencies", tenant],
    queryFn: () => api.listCurrencies(tenant),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });

  const value = useMemo<CurrencyCtx>(() => {
    const currencies = currenciesQ.data ?? [];
    const settings = settingsQ.data;
    const configured =
      currencies.find((c) => c.id === settings?.default_currency_id) ||
      currencies.find((c) => c.code === settings?.default_currency_code) ||
      FALLBACK;

    const convert = (amount: number, fromCode?: string): number => {
      const from = fromCode || configured.code;
      if (from.toUpperCase() === configured.code.toUpperCase()) return amount;
      const fromCur = currencies.find((c) => c.code.toUpperCase() === from.toUpperCase());
      return (amount / rateOf(fromCur)) * rateOf(configured);
    };

    const formatMoney = (amount: number, fromCode?: string): string =>
      formatAmount(convert(amount, fromCode), configured);

    return { currency: configured, currencies, convert, formatMoney };
  }, [settingsQ.data, currenciesQ.data]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCurrency(): CurrencyCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
