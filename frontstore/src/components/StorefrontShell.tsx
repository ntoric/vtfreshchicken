"use client";

import { type ReactNode } from "react";
import { AuthProvider } from "@/lib/auth";
import { CartProvider } from "@/lib/cart";
import { WishlistProvider } from "@/lib/wishlist";
import { CurrencyLangProvider, useCurrencyLang } from "@/lib/currency-lang";
import { BootstrapProvider } from "@/lib/bootstrap";
import { LocationProvider } from "@/lib/location";
import { LocationPicker } from "@/components/LocationPicker";
import { CartDrawer } from "@/components/CartDrawer";
import { WishlistDrawer } from "@/components/WishlistDrawer";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import type { BootstrapResponse } from "@/types";

export function StorefrontShell({
  bootstrap,
  children,
}: {
  bootstrap: BootstrapResponse;
  children: ReactNode;
}) {
  // Resolve the store's default currency code from bootstrap settings
  const defaultCurrency =
    (bootstrap.currencies || []).find(
      (c) => c.id === bootstrap.settings?.default_currency_id
    )?.code || "USD";
  const defaultLang = bootstrap.settings?.default_language || "en";
  const allowAnonymous = bootstrap.settings?.anonymous_checkout ?? true;

  return (
    <CurrencyLangProvider
      defaultCurrency={defaultCurrency}
      defaultLang={defaultLang}
    >
      <BootstrapProvider bootstrap={bootstrap}>
        <LocationProvider>
          <StorefrontInner
            bootstrap={bootstrap}
            allowAnonymous={allowAnonymous}
          >
            {children}
            <LocationPicker />
          </StorefrontInner>
        </LocationProvider>
      </BootstrapProvider>
    </CurrencyLangProvider>
  );
}

function StorefrontInner({
  bootstrap,
  allowAnonymous,
  children,
}: {
  bootstrap: BootstrapResponse;
  allowAnonymous: boolean;
  children: ReactNode;
}) {
  const { currency } = useCurrencyLang();
  const currencyObj = (bootstrap.currencies || []).find((c) => c.code === currency);

  return (
    <AuthProvider allowAnonymous={allowAnonymous}>
      <CartProvider currency={currency}>
        <WishlistProvider>
          {children}
          <CartDrawer currency={currencyObj} />
          <WishlistDrawer currency={currencyObj} />
          <CookieConsentBanner />
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  );
}
