"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

// ---- Currency + Language context ----
// Persists the selected currency and language across page navigations and
// refreshes using localStorage (keyed per tenant). Falls back to the tenant's
// default currency/language from bootstrap, then to "USD"/"en".

interface CurrencyLangCtx {
  currency: string;
  setCurrency: (c: string) => void;
  lang: string;
  setLang: (l: string) => void;
}

const Ctx = createContext<CurrencyLangCtx | null>(null);

const STORAGE_KEY_PREFIX = "tc_currency_";
const LANG_STORAGE_KEY_PREFIX = "tc_lang_";

export function CurrencyLangProvider({
  tenant,
  defaultCurrency,
  defaultLang,
  children,
}: {
  tenant: string;
  defaultCurrency: string;
  defaultLang: string;
  children: ReactNode;
}) {
  const [currency, setCurrencyState] = useState(defaultCurrency);
  const [lang, setLangState] = useState(defaultLang);
  const [hydrated, setHydrated] = useState(false);

  // On mount, read from localStorage (client-side only)
  useEffect(() => {
    try {
      const savedCur = localStorage.getItem(STORAGE_KEY_PREFIX + tenant);
      if (savedCur) setCurrencyState(savedCur);
      const savedLang = localStorage.getItem(LANG_STORAGE_KEY_PREFIX + tenant);
      if (savedLang) setLangState(savedLang);
    } catch {
      // localStorage not available (SSR / privacy mode) — ignore
    }
    setHydrated(true);
  }, [tenant]);

  // Keep currency in sync if the tenant default changes (e.g. admin updates it)
  useEffect(() => {
    if (!hydrated) return;
    try {
      const savedCur = localStorage.getItem(STORAGE_KEY_PREFIX + tenant);
      if (!savedCur) setCurrencyState(defaultCurrency);
    } catch {
      // ignore
    }
  }, [defaultCurrency, tenant, hydrated]);

  const setCurrency = useCallback((c: string) => {
    setCurrencyState(c);
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + tenant, c);
    } catch {
      // ignore
    }
  }, [tenant]);

  const setLang = useCallback((l: string) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_STORAGE_KEY_PREFIX + tenant, l);
    } catch {
      // ignore
    }
  }, [tenant]);

  return (
    <Ctx.Provider value={{ currency, setCurrency, lang, setLang }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCurrencyLang(): CurrencyLangCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Fallback for pages rendered outside the provider (shouldn't normally happen)
    return {
      currency: "USD",
      setCurrency: () => {},
      lang: "en",
      setLang: () => {},
    };
  }
  return ctx;
}
