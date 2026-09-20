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
  tenant: string;
  currency?: Currency;
}

export function ProductCard({ product, tenant, currency }: ProductCardProps) {
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
      href={`/${tenant}/products/${product.slug}`}
      className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-200"
    >
      <div className="relative aspect-square bg-gray-100 overflow-hidden">
        {displayImage ? (
          <Image
            src={displayImage}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">No image</div>
        )}
        {hasDiscount && (
          <span className="absolute top-3 left-3 bg-rose-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
            -{Math.round(product.discount_pct!)}%
          </span>
        )}
        {product.is_featured && !hasDiscount && !outOfStock && (
          <span className="absolute top-3 left-3 bg-amber-400 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-full">
            Featured
          </span>
        )}
        {outOfStock && (
          <span className="absolute top-3 left-3 bg-rose-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
            Out of Stock
          </span>
        )}
        {lowStock && !outOfStock && (
          <span className="absolute top-3 left-3 bg-amber-400 text-amber-900 text-xs font-bold px-2.5 py-1 rounded-full">
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
          className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-sm ${
            isWishlisted
              ? "bg-rose-500 text-white"
              : "bg-white/90 text-gray-600 hover:bg-white hover:text-rose-500"
          }`}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <svg className="w-5 h-5" fill={isWishlisted ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
          </svg>
        </button>
      </div>
      <div className="p-3 sm:p-4 space-y-1.5">
        <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">{product.category_slug || "General"}</p>
        <h3 className="font-semibold text-sm sm:text-base text-gray-900 line-clamp-2 group-hover:text-brand transition-colors">
          {product.name}
        </h3>
        <div className="flex items-center justify-between pt-1 gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="text-base sm:text-lg font-bold text-gray-900">{formatPrice(price, currency)}</span>
            {hasDiscount && (
              <span className="text-xs sm:text-sm text-gray-400 line-through">
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
            className={`rounded-lg p-2.5 transition-all touch-target ${
              outOfStock
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-brand text-white hover:bg-brand-dark md:opacity-0 md:group-hover:opacity-100"
            }`}
            aria-label="Add to cart"
          >
            <ShoppingCart className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
        {product.rating > 0 && (
          <div className="flex items-center gap-1 text-xs text-amber-500">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>{product.rating.toFixed(1)}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
