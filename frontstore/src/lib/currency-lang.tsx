"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

// ---- Currency + Language context ----
// Persists the selected currency and language across page navigations and
// refreshes using localStorage. Falls back to the store's default
// currency/language from bootstrap, then to "USD"/"en".

interface CurrencyLangCtx {
  currency: string;
  setCurrency: (c: string) => void;
  lang: string;
  setLang: (l: string) => void;
}

const Ctx = createContext<CurrencyLangCtx | null>(null);

const CURRENCY_STORAGE_KEY = "tc_currency";
const LANG_STORAGE_KEY = "tc_lang";

export function CurrencyLangProvider({
  defaultCurrency,
  defaultLang,
  children,
}: {
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
      const savedCur = localStorage.getItem(CURRENCY_STORAGE_KEY);
      if (savedCur) setCurrencyState(savedCur);
      const savedLang = localStorage.getItem(LANG_STORAGE_KEY);
      if (savedLang) setLangState(savedLang);
    } catch {
      // localStorage not available (SSR / privacy mode) — ignore
    }
    setHydrated(true);
  }, []);

  // Keep currency in sync if the store default changes (e.g. admin updates it)
  useEffect(() => {
    if (!hydrated) return;
    try {
      const savedCur = localStorage.getItem(CURRENCY_STORAGE_KEY);
      if (!savedCur) setCurrencyState(defaultCurrency);
    } catch {
      // ignore
    }
  }, [defaultCurrency, hydrated]);

  const setCurrency = useCallback((c: string) => {
    setCurrencyState(c);
    try {
      localStorage.setItem(CURRENCY_STORAGE_KEY, c);
    } catch {
      // ignore
    }
  }, []);

  const setLang = useCallback((l: string) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, l);
    } catch {
      // ignore
    }
  }, []);

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
