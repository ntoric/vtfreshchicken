"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, Plus, Snowflake, Star, ThermometerSnowflake } from "lucide-react";
import type { Product, Currency, Variant } from "@/types";
import { formatPrice } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { useBootstrap } from "@/lib/bootstrap";
import { thumbUrl } from "@/lib/images";

interface ProductCardProps {
  product: Product;
  currency?: Currency;
}

const MAX_SIZE_CHIPS = 3;

function attrValue(product: Product, slug: string): string | undefined {
  const a = product.attributes?.find((x) => x.attribute_slug === slug);
  return a?.option_label ?? a?.value_text ?? undefined;
}

function prettifySlug(slug: string) {
  return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ProductCard({ product, currency }: ProductCardProps) {
  const cart = useCart();
  const wishlist = useWishlist();
  const bootstrap = useBootstrap();
  const isWishlisted = wishlist?.isInWishlist(product.id) ?? false;

  const variants = useMemo(() => (product.variants ?? []).filter((v) => v.is_active !== false), [product.variants]);
  const hasVariants = variants.length > 0;
  // Default to the first size that is in stock.
  const [selectedId, setSelectedId] = useState<string | undefined>(
    () => (variants.find((v) => v.stock > 0) ?? variants[0])?.id
  );
  const selected: Variant | undefined = variants.find((v) => v.id === selectedId);

  const discountPct = product.discounted_price != null ? product.discount_pct ?? 0 : 0;
  const hasDiscount = discountPct > 0;
  // Same pricing rule as the product page: a size's price, less any offer.
  const listPrice = selected?.price ?? product.effective_price ?? (product.base_price || 0);
  const price = hasDiscount
    ? selected
      ? selected.price * (1 - discountPct / 100)
      : product.discounted_price ?? listPrice
    : listPrice;

  const totalStock = hasVariants ? variants.reduce((s, v) => s + (v.stock ?? 0), 0) : product.stock ?? 0;
  const outOfStock = totalStock <= 0;
  const stock = hasVariants ? selected?.stock ?? 0 : product.stock ?? 0;
  const selectedOut = stock <= 0;
  const lowStock = stock > 0 && stock <= (product.low_stock_threshold ?? 5);

  const image = selected?.image_url || product.image_url || product.images?.[0]?.url || variants[0]?.image_url;
  const categoryName = product.category_slug
    ? bootstrap?.categories?.find((c) => c.slug === product.category_slug)?.name ?? prettifySlug(product.category_slug)
    : undefined;
  const storage = attrValue(product, "storage");
  const isFrozen = storage ? /frozen/i.test(storage) : false;
  const isChilled = storage ? /chill/i.test(storage) : false;
  const packSize = !hasVariants ? attrValue(product, "pack-size") : undefined;

  const extraSizes = Math.max(0, variants.length - MAX_SIZE_CHIPS);
  const href = `/products/${product.slug}`;

  const badge = outOfStock
    ? { label: "Sold out", cls: "bg-neutral-900 text-white" }
    : hasDiscount
      ? { label: `${Math.round(discountPct)}% off`, cls: "bg-brand text-white" }
      : product.is_featured
        ? { label: "Bestseller", cls: "bg-white text-neutral-900 ring-1 ring-neutral-200" }
        : null;

  return (
    <article className="group relative flex flex-col rounded-2xl bg-white border border-neutral-200 p-1.5 transition-all duration-200 hover:border-neutral-300 hover:shadow-[0_12px_32px_-16px_rgba(0,0,0,0.25)]">
      {/* Image */}
      <div className="relative aspect-square overflow-hidden rounded-xl bg-neutral-100">
        {image ? (
          <Image
            src={thumbUrl(image)}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className={`object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] ${
              outOfStock ? "grayscale opacity-70" : ""
            }`}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-neutral-400">No image</div>
        )}

        {badge && (
          <span
            className={`absolute top-2 left-2 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none shadow-sm ${badge.cls}`}
          >
            {badge.label}
          </span>
        )}

        {(isFrozen || isChilled) && (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/90 backdrop-blur-sm px-2 py-1 text-[11px] font-medium leading-none text-neutral-700">
            {isFrozen ? (
              <Snowflake className="w-3 h-3 text-sky-600" aria-hidden />
            ) : (
              <ThermometerSnowflake className="w-3 h-3 text-emerald-600" aria-hidden />
            )}
            {isFrozen ? "Frozen" : "Chilled"}
          </span>
        )}

        <button
          type="button"
          onClick={() => wishlist?.toggleItem(product.id)}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          aria-pressed={isWishlisted}
          className={`absolute top-2 right-2 z-10 grid place-items-center w-8 h-8 rounded-full shadow-sm transition-colors ${
            isWishlisted ? "bg-rose-500 text-white" : "bg-white/90 backdrop-blur-sm text-neutral-500 hover:text-rose-500"
          }`}
        >
          <Heart className="w-4 h-4" fill={isWishlisted ? "currentColor" : "none"} strokeWidth={1.8} />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col px-2 pt-2.5 pb-1.5">
        <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-neutral-500">
          {categoryName && <span className="truncate">{categoryName}</span>}
          {product.rating > 0 && (
            <>
              {categoryName && <span aria-hidden>·</span>}
              <span className="inline-flex items-center gap-0.5 font-medium text-neutral-700 shrink-0">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" aria-hidden />
                {product.rating.toFixed(1)}
              </span>
            </>
          )}
        </div>

        <h3 className="mt-1 text-sm sm:text-[15px] font-semibold leading-snug text-neutral-900 line-clamp-2">
          {/* Stretched link: the whole card navigates; controls sit above it. */}
          <Link href={href} className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none group-hover:text-brand transition-colors">
            {product.name}
          </Link>
        </h3>

        {hasVariants ? (
          <div className="relative z-10 mt-2.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label={`${product.name} size`}>
            {variants.slice(0, MAX_SIZE_CHIPS).map((v) => {
              const active = v.id === selectedId;
              const unavailable = v.stock <= 0;
              return (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={unavailable}
                  onClick={() => setSelectedId(v.id)}
                  className={`rounded-lg border px-2 py-1 text-[11px] sm:text-xs font-medium leading-none transition-colors ${
                    active
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : unavailable
                        ? "border-neutral-200 text-neutral-300 line-through cursor-not-allowed"
                        : "border-neutral-200 text-neutral-700 hover:border-neutral-400"
                  }`}
                >
                  {v.name}
                </button>
              );
            })}
            {extraSizes > 0 && (
              <Link
                href={href}
                className="rounded-lg px-1.5 py-1 text-[11px] sm:text-xs font-medium leading-none text-neutral-500 hover:text-neutral-900"
              >
                +{extraSizes} more
              </Link>
            )}
          </div>
        ) : (
          packSize && <p className="mt-2 text-xs text-neutral-500">{packSize} pack</p>
        )}

        <div className="mt-auto pt-3 flex items-end justify-between gap-2">
          <div className="min-w-0">
            {hasDiscount && (
              <p className="text-[11px] sm:text-xs text-neutral-400 line-through leading-none mb-1">
                {formatPrice(listPrice, currency)}
              </p>
            )}
            <p className="text-base sm:text-lg font-bold tracking-tight text-neutral-900 leading-none">
              {formatPrice(price, currency)}
            </p>
            {lowStock && !selectedOut && (
              <p className="mt-1 text-[11px] font-medium text-amber-700 leading-none">Only {stock} left</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (!selectedOut) cart?.addItem(product.id, selected?.id, 1, price, currency?.code);
            }}
            disabled={selectedOut}
            aria-label={selectedOut ? "Sold out" : `Add ${product.name}${selected ? ` (${selected.name})` : ""} to cart`}
            className={`relative z-10 inline-flex shrink-0 items-center gap-1 rounded-full px-3 sm:px-3.5 h-9 text-xs sm:text-sm font-semibold transition-colors ${
              selectedOut
                ? "bg-neutral-100 text-neutral-400 cursor-not-allowed"
                : "bg-brand text-white hover:bg-brand-dark"
            }`}
          >
            {selectedOut ? (
              "Sold out"
            ) : (
              <>
                <Plus className="w-4 h-4" strokeWidth={2.5} aria-hidden /> Add
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
}
