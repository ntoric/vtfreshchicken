"use client";

import Link from "next/link";
import Image from "next/image";
import { Star, ShoppingCart } from "lucide-react";
import type { Product, Currency } from "@/types";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";

interface ProductCardProps {
  product: Product;
  currency?: Currency;
}

export function ProductCard({ product, currency }: ProductCardProps) {
  const price = product.discounted_price ?? product.effective_price ?? (product.base_price || product.variants?.[0]?.price) ?? 0;
  const hasDiscount = product.discounted_price != null && (product.discount_pct ?? 0) > 0;
  const cart = useCart();
  const wishlist = useWishlist();
  const isWishlisted = wishlist?.isInWishlist(product.id) ?? false;
  const variantStock = product.variants?.reduce((sum, v) => sum + (v.stock ?? 0), 0) ?? 0;
  const stock = product.stock || variantStock;
  const outOfStock = stock <= 0;
  const lowStock = stock > 0 && stock <= (product.low_stock_threshold ?? 5);
  const displayImage = product.image_url || product.images?.[0]?.url || product.variants?.[0]?.image_url;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col bg-white rounded-[1.35rem] ring-1 ring-stone-200/80 overflow-hidden transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-[0_24px_48px_-20px_rgba(68,64,60,0.35)] hover:ring-stone-300"
    >
      <div className="relative aspect-[5/4] bg-[#f4efe6] overflow-hidden">
        {displayImage ? (
          <Image
            src={displayImage}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.07]"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-stone-400">No image</div>
        )}

        {/* soft top veil */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/[0.06] via-transparent to-transparent pointer-events-none" />

        {/* Badges */}
        {hasDiscount && (
          <span className="absolute top-3 left-3 bg-brand text-white text-[11px] font-semibold tracking-wide px-2.5 py-1 rounded-full shadow-sm">
            −{Math.round(product.discount_pct!)}%
          </span>
        )}
        {product.is_featured && !hasDiscount && !outOfStock && (
          <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-stone-800 text-[11px] font-semibold tracking-wide px-2.5 py-1 rounded-full ring-1 ring-stone-200 shadow-sm">
            Bestseller
          </span>
        )}
        {outOfStock && (
          <span className="absolute top-3 left-3 bg-stone-900/90 backdrop-blur-sm text-white text-[11px] font-semibold tracking-wide px-2.5 py-1 rounded-full">
            Sold out
          </span>
        )}
        {lowStock && !outOfStock && (
          <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-amber-700 text-[11px] font-semibold tracking-wide px-2.5 py-1 rounded-full ring-1 ring-amber-200 shadow-sm">
            Only {stock} left
          </span>
        )}

        {/* Wishlist heart */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            wishlist?.toggleItem(product.id);
          }}
          className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm ring-1 ${
            isWishlisted
              ? "bg-rose-500 text-white ring-rose-500"
              : "bg-white/85 backdrop-blur-sm text-stone-500 ring-stone-200/80 hover:text-rose-500 hover:scale-110"
          }`}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <svg className="w-[18px] h-[18px]" fill={isWishlisted ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col flex-1 p-3.5 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] sm:text-[11px] text-stone-400 uppercase tracking-[0.16em] font-medium">
            {product.category_slug || "General"}
          </p>
          {product.rating > 0 && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-stone-700">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              {product.rating.toFixed(1)}
            </span>
          )}
        </div>

        <h3 className="font-display font-semibold text-[15px] sm:text-[17px] leading-snug text-stone-900 mt-1.5 line-clamp-2 group-hover:text-brand transition-colors">
          {product.name}
        </h3>

        <div className="mt-auto pt-3 flex items-center justify-between gap-2 border-t border-dashed border-stone-200">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="font-display text-lg sm:text-xl font-bold text-stone-900">
              {formatPrice(price, currency)}
            </span>
            {hasDiscount && (
              <span className="text-xs sm:text-sm text-stone-400 line-through">
                {formatPrice(product.effective_price ?? product.base_price, currency)}
              </span>
            )}
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!outOfStock) cart?.addItem(product.id, undefined, 1, price, currency?.code);
            }}
            disabled={outOfStock}
            className={`rounded-full w-9 h-9 flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
              outOfStock
                ? "bg-stone-100 text-stone-300 cursor-not-allowed"
                : "bg-brand text-white hover:bg-brand-dark hover:scale-110 shadow-sm md:opacity-0 md:group-hover:opacity-100"
            }`}
            aria-label="Add to cart"
          >
            <ShoppingCart className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </Link>
  );
}
