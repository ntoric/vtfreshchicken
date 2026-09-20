"use client";

import { type ReactNode } from "react";
import { AuthProvider } from "@/lib/auth";
import { CartProvider } from "@/lib/cart";
import { WishlistProvider } from "@/lib/wishlist";
import { CurrencyLangProvider, useCurrencyLang } from "@/lib/currency-lang";
import { CartDrawer } from "@/components/CartDrawer";
import { WishlistDrawer } from "@/components/WishlistDrawer";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import type { BootstrapResponse } from "@/types";

export function StorefrontShell({
  tenant,
  bootstrap,
  children,
}: {
  tenant: string;
  bootstrap: BootstrapResponse;
  children: ReactNode;
}) {
  // Resolve the tenant's default currency code from bootstrap settings
  const defaultCurrency =
    (bootstrap.currencies || []).find(
      (c) => c.id === bootstrap.settings?.default_currency_id
    )?.code || "USD";
  const defaultLang = bootstrap.settings?.default_language || "en";
  const allowAnonymous = bootstrap.settings?.anonymous_checkout ?? true;

  return (
    <CurrencyLangProvider
      tenant={tenant}
      defaultCurrency={defaultCurrency}
      defaultLang={defaultLang}
    >
      <StorefrontInner
        tenant={tenant}
        bootstrap={bootstrap}
        allowAnonymous={allowAnonymous}
      >
        {children}
      </StorefrontInner>
    </CurrencyLangProvider>
  );
}

function StorefrontInner({
  tenant,
  bootstrap,
  allowAnonymous,
  children,
}: {
  tenant: string;
  bootstrap: BootstrapResponse;
  allowAnonymous: boolean;
  children: ReactNode;
}) {
  const { currency } = useCurrencyLang();
  const currencyObj = (bootstrap.currencies || []).find((c) => c.code === currency);

  return (
    <AuthProvider allowAnonymous={allowAnonymous}>
      <CartProvider tenant={tenant} currency={currency}>
        <WishlistProvider tenant={tenant}>
          {children}
          <CartDrawer tenant={tenant} currency={currencyObj} />
          <WishlistDrawer tenant={tenant} currency={currencyObj} />
          <CookieConsentBanner tenant={tenant} />
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  );
}
