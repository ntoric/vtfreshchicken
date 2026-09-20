"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { useWishlist } from "@/lib/wishlist";
import { useCart } from "@/lib/cart";
import { InlineLoader } from "@/components/Loaders";
import { formatPrice } from "@/lib/format";
import type { Currency } from "@/types";

export function WishlistDrawer({ tenant, currency }: { tenant: string; currency?: Currency }) {
  const { wishlist, isOpen, closeWishlist, removeItem, isLoading } = useWishlist();
  const cart = useCart();

  if (!isOpen) return null;

  const items = wishlist?.wishlist.items ?? [];

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50 transition-opacity" onClick={closeWishlist} />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-50 shadow-2xl flex flex-col animate-slide-in pt-safe pb-safe">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b">
          <h2 className="text-lg font-bold text-gray-900">
            Wishlist {items.length > 0 && `(${items.length})`}
          </h2>
          <button onClick={closeWishlist} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Close wishlist">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1"><InlineLoader label="Loading wishlist" /></div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-400">
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
            </svg>
            <p className="text-lg font-medium">Your wishlist is empty</p>
            <Link href={`/${tenant}`} onClick={closeWishlist} className="text-brand font-medium hover:underline inline-flex items-center gap-1">
              Browse products <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <Link href={`/${tenant}/products/${item.slug}`} onClick={closeWishlist} className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                    {item.image_url && (
                      <Image src={item.image_url} alt={item.product_name} fill sizes="80px" className="object-cover" />
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href={`/${tenant}/products/${item.slug}`} onClick={closeWishlist}>
                      <p className="font-medium text-gray-900 text-sm line-clamp-2 hover:text-brand transition">{item.product_name}</p>
                    </Link>
                    <p className="text-sm font-semibold text-gray-900 mt-1">{formatPrice(item.base_price, currency)}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        onClick={() => cart?.addItem(item.product_id, undefined, 1, item.base_price, currency?.code)}
                        className="text-xs font-medium text-brand hover:underline flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Add to cart
                      </button>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-xs text-rose-500 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t p-4 sm:p-5">
              <Link
                href={`/${tenant}/wishlist`}
                onClick={closeWishlist}
                className="block text-center border border-gray-300 rounded-xl py-3 font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                View Full Wishlist
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  );
}
