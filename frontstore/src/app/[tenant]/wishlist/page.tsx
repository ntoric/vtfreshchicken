"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { fetchBootstrap } from "@/lib/api";
import { Header } from "@/components/Header";
import { WishlistSkeleton } from "@/components/Loaders";
import { useWishlist } from "@/lib/wishlist";
import { useCart } from "@/lib/cart";
import { formatPrice, getCurrencySymbol } from "@/lib/format";
import { useCurrencyLang } from "@/lib/currency-lang";

export default function WishlistPage({ params }: { params: { tenant: string } }) {
  const { currency, setCurrency, lang, setLang } = useCurrencyLang();

  const bootstrapQ = useQuery({
    queryKey: ["bootstrap", params.tenant],
    queryFn: () => fetchBootstrap(params.tenant),
  });

  const bootstrap = bootstrapQ.data;
  const currencyObj = getCurrencySymbol(bootstrap?.currencies || [], currency);
  const wishlist = useWishlist();
  const cart = useCart();

  if (bootstrapQ.isLoading) {
    return <WishlistSkeleton />;
  }
  if (!bootstrap) {
    return (
      <div className="min-h-screen flex items-center justify-center text-rose-500">
        Failed to load store.
      </div>
    );
  }

  const items = wishlist?.wishlist?.wishlist.items ?? [];

  return (
    <div className="min-h-screen">
      <Header
        tenant={params.tenant}
        bootstrap={bootstrap}
        currency={currency}
        setCurrency={setCurrency}
        lang={lang}
        setLang={setLang}
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <div className="flex items-center justify-between mb-6 sm:mb-8 gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">My Wishlist</h1>
            <p className="text-sm sm:text-base text-gray-500 mt-1">
              {items.length === 0
                ? "No items yet"
                : `${items.length} item${items.length > 1 ? "s" : ""} saved`}
            </p>
          </div>
          <Link href={`/${params.tenant}`} className="text-brand font-medium hover:underline text-sm whitespace-nowrap flex-shrink-0 inline-flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Continue shopping
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-gray-400">
            <svg className="w-16 h-16 sm:w-20 sm:h-20 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
            </svg>
            <p className="text-lg font-medium">Your wishlist is empty</p>
            <p className="text-sm mt-1">Save items you love to find them here later.</p>
            <Link href={`/${params.tenant}`} className="mt-6 inline-flex items-center gap-1.5 bg-brand text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-brand-dark transition">
              <ArrowLeft className="w-4 h-4" /> Browse Products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
            {items.map((item) => (
              <div key={item.id} className="bg-white rounded-2xl border overflow-hidden group flex flex-col">
                <Link href={`/${params.tenant}/products/${item.slug}`} className="relative aspect-square bg-gray-100 block overflow-hidden">
                  {item.image_url ? (
                    <Image src={item.image_url} alt={item.product_name} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400 text-xs">No image</div>
                  )}
                </Link>
                <div className="p-3 sm:p-4 flex-1 flex flex-col">
                  <Link href={`/${params.tenant}/products/${item.slug}`}>
                    <h3 className="font-semibold text-sm sm:text-base text-gray-900 line-clamp-2 hover:text-brand transition">
                      {item.product_name}
                    </h3>
                  </Link>
                  <p className="text-base sm:text-lg font-bold text-gray-900 mt-2">{formatPrice(item.base_price || 0, currencyObj)}</p>
                  <div className="flex items-center gap-2 mt-3 sm:mt-4">
                    <button
                      onClick={() => cart?.addItem(item.product_id, item.variant_id || undefined, 1, item.base_price || undefined, currency)}
                      className="flex-1 bg-brand text-white text-xs sm:text-sm font-medium py-2 rounded-lg hover:bg-brand-dark transition"
                    >
                      Add to Cart
                    </button>
                    <button
                      onClick={() => wishlist?.removeItem(item.id)}
                      className="p-2.5 rounded-xl border border-gray-200 text-rose-500 hover:bg-rose-50 hover:border-rose-200 transition flex-shrink-0"
                      aria-label="Remove from wishlist"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
