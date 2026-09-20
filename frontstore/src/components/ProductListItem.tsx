"use client";

import Link from "next/link";
import Image from "next/image";
import { Star, ShoppingCart } from "lucide-react";
import type { Product, Currency } from "@/types";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";

interface ProductListItemProps {
  product: Product;
  tenant: string;
  currency?: Currency;
}

export function ProductListItem({ product, tenant, currency }: ProductListItemProps) {
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
      className="group flex flex-col sm:flex-row bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-200"
    >
      {/* Image */}
      <div className="relative w-full sm:w-48 md:w-56 aspect-square sm:aspect-auto flex-shrink-0 bg-gray-100 overflow-hidden">
        {displayImage ? (
          <Image
            src={displayImage}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, 224px"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">No image</div>
        )}
        {hasDiscount && (
          <span className="absolute top-3 left-3 bg-rose-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
            -{Math.round(product.discount_pct!)}%
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
      </div>

      {/* Details */}
      <div className="flex-1 p-4 sm:p-5 flex flex-col gap-2 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">
              {product.category_slug || "General"}
            </p>
            <h3 className="font-semibold text-base sm:text-lg text-gray-900 line-clamp-2 group-hover:text-brand transition-colors">
              {product.name}
            </h3>
          </div>
          {/* Wishlist heart */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              wishlist?.toggleItem(product.id);
            }}
            className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-sm ${
              isWishlisted
                ? "bg-rose-500 text-white"
                : "bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-rose-500"
            }`}
            aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          >
            <svg className="w-5 h-5" fill={isWishlisted ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
            </svg>
          </button>
        </div>

        {product.description && (
          <p className="text-sm text-gray-500 line-clamp-2 hidden sm:block">
            {product.description}
          </p>
        )}

        <div className="flex items-center gap-2 text-xs text-gray-400">
          {product.rating > 0 && (
            <span className="flex items-center gap-1 text-amber-500">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>{product.rating.toFixed(1)}</span>
            </span>
          )}
          {product.sku && (
            <span className="hidden sm:inline">SKU: {product.sku}</span>
          )}
        </div>

        {/* Price + actions pinned to bottom */}
        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg sm:text-xl font-bold text-gray-900">
              {formatPrice(price, currency)}
            </span>
            {hasDiscount && (
              <span className="text-sm text-gray-400 line-through">
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
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              outOfStock
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-brand text-white hover:bg-brand-dark"
            }`}
            aria-label="Add to cart"
          >
            <ShoppingCart className="w-4 h-4" strokeWidth={2} />
            <span className="hidden sm:inline">Add to cart</span>
          </button>
        </div>
      </div>
    </Link>
  );
}
