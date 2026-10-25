"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState, useMemo, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { fetchBootstrap, fetchProduct } from "@/lib/api";
import { Header } from "@/components/Header";
import { ProductGallery } from "@/components/ProductGallery";
import { ReviewsSection } from "@/components/ReviewsSection";
import { SimilarProducts } from "@/components/SimilarProducts";
import { ProductDetailSkeleton } from "@/components/Loaders";
import { formatPrice, getCurrencySymbol } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import type { Attribute, ProductAttributeValue, Variant } from "@/types";
import { useCurrencyLang } from "@/lib/currency-lang";

// Map common color names to hex for swatch backgrounds
const COLOR_MAP: Record<string, string> = {
  red: "#ef4444", crimson: "#dc143c", scarlet: "#ff2400",
  blue: "#3b82f6", navy: "#1e3a8a", sky: "#0ea5e9", cobalt: "#0047ab",
  green: "#22c55e", olive: "#808000", lime: "#84cc16", emerald: "#10b981",
  yellow: "#eab308", gold: "#d4af37",
  orange: "#f97316", coral: "#ff7f50",
  purple: "#a855f7", violet: "#8b5cf6", magenta: "#d946ef",
  pink: "#ec4899", rose: "#f43f5e",
  black: "#111827", white: "#ffffff", gray: "#6b7280", grey: "#6b7280",
  brown: "#92400e", tan: "#d2b48c", beige: "#f5f5dc",
  silver: "#c0c0c0", charcoal: "#36454f",
};

function colorNameToHex(name: string): string {
  const lower = name.toLowerCase().trim();
  if (COLOR_MAP[lower]) return COLOR_MAP[lower];
  // Try partial match
  for (const [key, hex] of Object.entries(COLOR_MAP)) {
    if (lower.includes(key)) return hex;
  }
  return "#d1d5db"; // default gray
}

function formatAttrValue(a: ProductAttributeValue, attributes?: Attribute[]): string | number | undefined {
  const type = attributes?.find((x) => x.id === a.attribute_id || x.slug === a.attribute_slug)?.type;
  if (type === "datetime" && a.value_text) {
    const d = new Date(a.value_text);
    if (!isNaN(d.getTime())) return d.toLocaleString();
  }
  return a.value_text ?? a.value_number;
}

export default function ProductDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const { currency, setCurrency, lang, setLang } = useCurrencyLang();
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [activeTab, setActiveTab] = useState<"description" | "specs" | "info" | "reviews">("description");
  const cart = useCart();
  const wishlist = useWishlist();

  const bootstrapQ = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => fetchBootstrap(),
  });

  const productQ = useQuery({
    queryKey: ["product", params.slug, currency, lang],
    queryFn: () => fetchProduct(params.slug, currency, lang),
    enabled: !!bootstrapQ.data,
  });

  const bootstrap = bootstrapQ.data;
  const currencyObj = getCurrencySymbol(bootstrap?.currencies || [], currency);
  const { product } = productQ.data || {};
  const hasVariants = (product?.variants?.length ?? 0) > 0;
  const variantPrice = selectedVariant?.price;
  const basePrice = variantPrice ?? product?.effective_price ?? product?.base_price ?? 0;
  const price = product?.discounted_price != null
    ? (variantPrice ? variantPrice * (1 - (product.discount_pct ?? 0) / 100) : product.discounted_price)
    : basePrice;
  const hasDiscount = product?.discounted_price != null && (product?.discount_pct || 0) > 0;
  const inStock = hasVariants
    ? (selectedVariant?.stock ?? 0) > 0
    : (product?.stock ?? 0) > 0;
  const availableStock = hasVariants
    ? (selectedVariant?.stock ?? 0)
    : (product?.stock ?? 0);
  const maxStock = (product?.track_inventory ?? true) ? Math.max(1, availableStock) : 999;

  // Build attribute groups from variants: { attrName: [{ value, label, available }] }
  const variantGroups = useMemo(() => {
    const groups: Record<string, { value: string; label: string }[]> = {};
    if (!product?.variants) return groups;
    for (const v of product.variants) {
      for (const attr of v.attributes || []) {
        if (!groups[attr.attribute_name]) groups[attr.attribute_name] = [];
        if (!groups[attr.attribute_name].some((g) => g.value === attr.option_value)) {
          groups[attr.attribute_name].push({ value: attr.option_value, label: attr.option_label || attr.option_value });
        }
      }
    }
    return groups;
  }, [product?.variants]);

  const allOptionsSelected = hasVariants && Object.keys(variantGroups).every((k) => selectedOptions[k]);

  // Check if a specific option value is available given other selected options
  const isOptionAvailable = (attrName: string, value: string): boolean => {
    if (!product?.variants) return false;
    return product.variants.some((v) => {
      const attrs = v.attributes || [];
      const hasThis = attrs.some((a) => a.attribute_name === attrName && a.option_value === value);
      if (!hasThis) return false;
      // Check all OTHER selected options match
      for (const [otherAttr, otherVal] of Object.entries(selectedOptions)) {
        if (otherAttr === attrName) continue;
        const hasOther = attrs.some((a) => a.attribute_name === otherAttr && a.option_value === otherVal);
        if (!hasOther) return false;
      }
      return v.stock > 0;
    });
  };

  // Find the matching variant based on all selected options
  const matchedVariant = useMemo(() => {
    if (!product?.variants || product.variants.length === 0) return null;
    const groupKeys = Object.keys(variantGroups);
    if (groupKeys.length === 0) return null;
    // Need all options selected to match
    if (groupKeys.some((k) => !selectedOptions[k])) return null;
    return product.variants.find((v) => {
      const attrs = v.attributes || [];
      return groupKeys.every((attrName) =>
        attrs.some((a) => a.attribute_name === attrName && a.option_value === selectedOptions[attrName])
      );
    }) ?? null;
  }, [product?.variants, variantGroups, selectedOptions]);

  // Sync selectedVariant with matchedVariant
  useEffect(() => {
    if (matchedVariant && selectedVariant?.id !== matchedVariant.id) {
      setSelectedVariant(matchedVariant);
    } else if (!matchedVariant && product?.variants && product.variants.length > 0) {
      // Auto-select first available variant's options on initial load
      const firstAvailable = product.variants.find((v) => v.stock > 0) ?? product.variants[0];
      const initialOpts: Record<string, string> = {};
      for (const attr of firstAvailable.attributes || []) {
        initialOpts[attr.attribute_name] = attr.option_value;
      }
      if (Object.keys(initialOpts).length > 0 && Object.keys(selectedOptions).length === 0) {
        setSelectedOptions(initialOpts);
      }
    }
  }, [matchedVariant, selectedVariant, product?.variants, selectedOptions]);

  // Reset selections when product changes
  useEffect(() => {
    setSelectedOptions({});
    setSelectedVariant(null);
    setQty(1);
  }, [product?.id]);

  if (bootstrapQ.isLoading || productQ.isLoading) {
    return <ProductDetailSkeleton />;
  }
  if (!bootstrap || !product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-gray-500">
        <p>Product not found.</p>
        <Link href={``} className="text-brand hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to store
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header
       
        bootstrap={bootstrap}
        currency={currency}
        setCurrency={setCurrency}
        lang={lang}
        setLang={setLang}
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* Breadcrumb */}
        <nav className="text-xs sm:text-sm text-gray-400 mb-4 sm:mb-6 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <Link href={``} className="hover:text-gray-600 whitespace-nowrap">Home</Link>
          <span>/</span>
          {product.category_slug && (
            <>
              <Link href={`/?category=${product.category_slug}`} className="hover:text-gray-600 capitalize whitespace-nowrap">
                {product.category_slug}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-gray-600 truncate">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-10">
          {/* Image gallery with hover zoom */}
          <ProductGallery
            images={product.images || []}
            fallbackUrl={product.image_url}
            alt={product.name}
          />

          {/* Product info */}
          <div className="space-y-5 sm:space-y-6">
            <div>
              <p className="text-xs sm:text-sm text-brand font-medium uppercase tracking-wide">{product.category_slug}</p>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-1">{product.name}</h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {product.rating > 0 && (
                  <div className="flex items-center gap-1 text-amber-500">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                          key={star}
                          className={`w-4 h-4 ${star <= Math.round(product.rating) ? "fill-current" : "fill-gray-200"}`}
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="font-medium text-sm">{product.rating.toFixed(1)}</span>
                  </div>
                )}
                <span className="text-gray-300">|</span>
                <span className="text-xs sm:text-sm text-gray-500">SKU: {product.sku}</span>
              </div>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap">
              <span className="text-2xl sm:text-3xl font-bold text-gray-900">{formatPrice(price, currencyObj)}</span>
              {hasDiscount && (
                <>
                  <span className="text-base sm:text-lg text-gray-400 line-through">
                    {formatPrice(product.effective_price ?? product.base_price, currencyObj)}
                  </span>
                  <span className="bg-rose-100 text-rose-600 text-xs sm:text-sm font-bold px-2.5 py-1 rounded-lg">
                    Save {Math.round(product.discount_pct!)}%
                  </span>
                </>
              )}
            </div>

            {/* Stock status */}
            <div className="flex items-center gap-2">
              {inStock ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-sm font-medium text-emerald-600">In Stock</span>
                  <span className="text-sm text-gray-400">
                    ({selectedVariant ? selectedVariant.stock : product.stock} available)
                  </span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="text-sm font-medium text-rose-600">Out of Stock</span>
                </>
              )}
            </div>

            <p className="text-gray-600 leading-relaxed">{product.description}</p>

            {/* Variant selection — independent attribute pickers */}
            {hasVariants && (
              <div className="space-y-5 pt-2">
                {Object.entries(variantGroups).map(([attrName, options]) => {
                  const isColor = attrName.toLowerCase() === "color" || attrName.toLowerCase() === "colour";
                  const selectedVal = selectedOptions[attrName];
                  const selectedLabel = options.find((o) => o.value === selectedVal)?.label;
                  return (
                    <div key={attrName} className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900 text-sm">
                          {attrName}
                          {selectedLabel && (
                            <span className="text-gray-400 font-normal ml-2">: {selectedLabel}</span>
                          )}
                        </h3>
                      </div>
                      {isColor ? (
                        // Color swatches
                        <div className="flex flex-wrap gap-2.5">
                          {options.map((opt) => {
                            const isSelected = selectedVal === opt.value;
                            const available = isOptionAvailable(attrName, opt.value);
                            return (
                              <button
                                key={opt.value}
                                onClick={() => setSelectedOptions((prev) => ({ ...prev, [attrName]: opt.value }))}
                                disabled={!available}
                                className={`relative w-10 h-10 rounded-full border-2 transition-all ${
                                  isSelected
                                    ? "border-brand ring-2 ring-brand/20 scale-110"
                                    : available
                                      ? "border-gray-200 hover:border-gray-400"
                                      : "border-gray-100 opacity-40 cursor-not-allowed"
                                }`}
                                style={{ backgroundColor: colorNameToHex(opt.label) }}
                                title={`${opt.label}${available ? "" : " (unavailable)"}`}
                                aria-label={`${attrName}: ${opt.label}`}
                              >
                                {!available && (
                                  <span className="absolute inset-0 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" d="M6 18L18 6" />
                                    </svg>
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        // Standard buttons (size, material, etc.)
                        <div className="flex flex-wrap gap-2">
                          {options.map((opt) => {
                            const isSelected = selectedVal === opt.value;
                            const available = isOptionAvailable(attrName, opt.value);
                            return (
                              <button
                                key={opt.value}
                                onClick={() => setSelectedOptions((prev) => ({ ...prev, [attrName]: opt.value }))}
                                disabled={!available}
                                className={`min-w-[3rem] px-3 py-2 rounded-lg border text-sm font-medium transition relative ${
                                  isSelected
                                    ? "border-brand bg-brand-light text-brand"
                                    : available
                                      ? "border-gray-200 hover:border-gray-400 text-gray-700"
                                      : "border-gray-100 text-gray-300 cursor-not-allowed line-through"
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Fallback: variants without attributes — select by name */}
                {Object.keys(variantGroups).length === 0 && (
                  <div className="space-y-2.5">
                    <h3 className="font-semibold text-gray-900 text-sm">Options</h3>
                    <div className="flex flex-wrap gap-2">
                      {product.variants!.map((v) => {
                        const isSelected = selectedVariant?.id === v.id;
                        const available = v.stock > 0;
                        return (
                          <button
                            key={v.id}
                            onClick={() => {
                              setSelectedVariant(v);
                              setSelectedOptions({});
                            }}
                            disabled={!available}
                            className={`px-3 py-2 rounded-lg border text-sm font-medium transition ${
                              isSelected
                                ? "border-brand bg-brand-light text-brand"
                                : available
                                  ? "border-gray-200 hover:border-gray-400 text-gray-700"
                                  : "border-gray-100 text-gray-300 cursor-not-allowed line-through"
                            }`}
                          >
                            {v.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Selection status */}
                {hasVariants && Object.keys(variantGroups).length > 0 && (
                  <div className="text-sm">
                    {allOptionsSelected ? (
                      selectedVariant ? (
                        <span className="text-emerald-600 flex items-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                          {selectedVariant.stock > 0
                            ? `In stock: ${selectedVariant.stock} available`
                            : "This combination is out of stock"}
                        </span>
                      ) : (
                        <span className="text-amber-600">This combination is not available</span>
                      )
                    ) : (
                      <span className="text-gray-400">
                        Please select: {Object.keys(variantGroups).filter((k) => !selectedOptions[k]).join(", ")}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Quantity + add to cart + wishlist */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-4">
              <div className="flex items-center border rounded-xl self-start">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="px-3 py-2 text-gray-500 hover:text-gray-900"
                >−</button>
                <span className="px-4 py-2 font-medium">{qty}</span>
                <button
                  onClick={() => setQty((q) => Math.min(maxStock, q + 1))}
                  disabled={qty >= maxStock}
                  className="px-3 py-2 text-gray-500 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
                >+</button>
              </div>
              <button
                onClick={() => {
                  const p = productQ.data?.product;
                  if (!p) return;
                  const unitPrice = selectedVariant?.price ?? p.effective_price ?? p.base_price;
                  cart?.addItem(p.id, selectedVariant?.id, qty, unitPrice, currency);
                }}
                disabled={!inStock || (hasVariants && !selectedVariant)}
                className="flex-1 bg-brand text-white font-semibold py-2.5 rounded-lg hover:bg-brand-dark transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {!inStock
                  ? "Out of Stock"
                  : hasVariants && !selectedVariant
                    ? "Select Options"
                    : "Add to Cart"}
              </button>
              <button
                onClick={() => wishlist?.toggleItem(product.id, selectedVariant?.id)}
                className={`flex items-center justify-center w-12 h-12 rounded-xl border-2 transition self-start sm:self-auto ${
                  wishlist?.isInWishlist(product.id)
                    ? "border-rose-500 bg-rose-50 text-rose-500"
                    : "border-gray-200 text-gray-400 hover:border-rose-300 hover:text-rose-400"
                }`}
                aria-label={wishlist?.isInWishlist(product.id) ? "Remove from wishlist" : "Add to wishlist"}
              >
                <svg className="w-6 h-6" fill={wishlist?.isInWishlist(product.id) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                </svg>
              </button>
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-4 border-t">
              <div className="flex flex-col items-center text-center gap-1">
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span className="text-xs text-gray-500">Secure Payment</span>
              </div>
              <div className="flex flex-col items-center text-center gap-1">
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-6m6 0V10.5m-6 8.25V10.5m6 0H9.75M16.5 6.75h-3.75v3.75h3.75V6.75Z" />
                </svg>
                <span className="text-xs text-gray-500">Free Shipping</span>
              </div>
              <div className="flex flex-col items-center text-center gap-1">
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 8.62 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3-3 3" />
                </svg>
                <span className="text-xs text-gray-500">30-Day Returns</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabbed details section */}
        <div className="mt-8 sm:mt-12 border-t pt-6 sm:pt-8">
          <div className="flex gap-1 border-b overflow-x-auto no-scrollbar">
            {([
              ["description", "Description"],
              ["specs", "Specifications"],
              ["info", "Additional Info"],
              ["reviews", "Reviews"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-4 sm:px-5 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                  activeTab === key
                    ? "border-brand text-brand"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {label}
                {key === "reviews" && product.rating > 0 && (
                  <span className="ml-1.5 text-xs">({product.rating.toFixed(1)})</span>
                )}
              </button>
            ))}
          </div>

          <div className="py-6 max-w-4xl">
            {/* Description tab */}
            {activeTab === "description" && (
              <div className="prose prose-sm text-gray-600 space-y-4 max-w-none">
                <p className="leading-relaxed text-base">{product.description}</p>
                <p className="leading-relaxed">
                  Experience quality and craftsmanship with the {product.name}. Designed with both style
                  and functionality in mind, this product is perfect for everyday use. Each item is carefully
                  inspected to ensure the highest standards of quality and durability.
                </p>
                <h3 className="font-semibold text-gray-900 text-base pt-2">Key Features</h3>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    <span>Premium quality materials sourced for durability and comfort</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    <span>Designed with attention to detail for a superior experience</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    <span>Backed by our 1-year manufacturer warranty</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    <span>Eco-friendly packaging and sustainable practices</span>
                  </li>
                </ul>
              </div>
            )}

            {/* Specifications tab */}
            {activeTab === "specs" && (
              <div className="space-y-6">
                <h3 className="font-semibold text-gray-900 text-lg">Technical Specifications</h3>
                <div className="table-wrap overflow-hidden rounded-xl border">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-600 w-1/3">SKU</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{product.sku}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="px-4 py-3 font-medium text-gray-600">Category</td>
                        <td className="px-4 py-3 font-medium text-gray-900 capitalize">{product.category_slug || "—"}</td>
                      </tr>
                      <tr className="border-b bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-600">Rating</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{product.rating.toFixed(1)} / 5.0</td>
                      </tr>
                      <tr className="border-b">
                        <td className="px-4 py-3 font-medium text-gray-600">Availability</td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          <span className={inStock ? "text-emerald-600" : "text-rose-600"}>
                            {inStock ? "In Stock" : "Out of Stock"}
                          </span>
                        </td>
                      </tr>
                      <tr className="border-b bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-600">Featured</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{product.is_featured ? "Yes" : "No"}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="px-4 py-3 font-medium text-gray-600">Currency</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{product.currency_code}</td>
                      </tr>
                      {product.attributes?.map((a, i) => (
                        <tr key={a.attribute_id} className={i % 2 === 0 ? "border-b bg-gray-50" : "border-b"}>
                          <td className="px-4 py-3 font-medium text-gray-600">{a.attribute_name}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {a.option_label || formatAttrValue(a, bootstrap?.attributes) || (a.value_bool ? "Yes" : "No")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Variant specs */}
                {product.variants && product.variants.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg mb-3">Available Variants</h3>
                    <div className="table-wrap overflow-hidden rounded-xl border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b">
                            <th className="px-4 py-3 text-left font-medium text-gray-600">Variant</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-600">SKU</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-600">Stock</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-600">Attributes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {product.variants.map((v, i) => (
                            <tr key={v.id} className={i % 2 === 0 ? "border-b" : "border-b bg-gray-50"}>
                              <td className="px-4 py-3 font-medium text-gray-900">{v.name}</td>
                              <td className="px-4 py-3 text-gray-600">{v.sku}</td>
                              <td className="px-4 py-3 text-gray-600">{v.stock}</td>
                              <td className="px-4 py-3 text-gray-600">
                                {v.attributes?.map((a) => `${a.attribute_name}: ${a.option_label || a.option_value}`).join(", ") || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Additional Info tab */}
            {activeTab === "info" && (
              <div className="space-y-8">
                {/* Shipping */}
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-6m6 0V10.5m-6 8.25V10.5m6 0H9.75M16.5 6.75h-3.75v3.75h3.75V6.75Z" />
                    </svg>
                    Shipping Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="font-semibold text-gray-900 text-sm">Standard Shipping</p>
                      <p className="text-gray-500 text-sm mt-1">3-5 business days</p>
                      <p className="text-emerald-600 font-medium text-sm mt-2">FREE</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="font-semibold text-gray-900 text-sm">Express Shipping</p>
                      <p className="text-gray-500 text-sm mt-1">1-2 business days</p>
                      <p className="text-gray-700 font-medium text-sm mt-2">Calculated at checkout</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <p className="font-semibold text-gray-900 text-sm">International</p>
                      <p className="text-gray-500 text-sm mt-1">7-14 business days</p>
                      <p className="text-gray-700 font-medium text-sm mt-2">Varies by location</p>
                    </div>
                  </div>
                </div>

                {/* Returns */}
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 8.62 0 4.006 4.006 0 0 0 3.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3-3 3" />
                    </svg>
                    Returns & Warranty
                  </h3>
                  <div className="space-y-3 text-sm text-gray-600">
                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 text-xs font-bold">30</span>
                      <div>
                        <p className="font-medium text-gray-900">30-Day Return Policy</p>
                        <p>Return any item within 30 days for a full refund. Items must be in original, unworn condition with tags attached.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-brand-light text-brand flex items-center justify-center flex-shrink-0 text-xs font-bold">1Y</span>
                      <div>
                        <p className="font-medium text-gray-900">1-Year Warranty</p>
                        <p>All products come with a standard 1-year manufacturer warranty covering defects in materials and workmanship.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0 text-xs font-bold">$</span>
                      <div>
                        <p className="font-medium text-gray-900">Price Match Guarantee</p>
                        <p>Found it cheaper elsewhere? We will match the price. Contact our support team within 7 days of purchase.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Care instructions */}
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                    </svg>
                    Care Instructions
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 0 0 9-9 9 9 0 0 0-9-9 9 9 0 0 0-9 9 9 9 0 0 0 9 9Z" /></svg>
                      </span>
                      <span>Machine wash cold with similar colors</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>
                      </span>
                      <span>Do not bleach or use harsh detergents</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 2.06-6.38A14.98 14.98 0 0 0 12 2.25a14.98 14.98 0 0 0-2.06 6.38m-2.06 5.74a6 6 0 0 1-5.84-7.38v4.8m11.59-2.58a6 6 0 0 0-5.84-7.38" /></svg>
                      </span>
                      <span>Tumble dry low or air dry recommended</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                      </span>
                      <span>Iron on low heat if needed</span>
                    </div>
                  </div>
                </div>

                {/* FAQ */}
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg mb-3">Frequently Asked Questions</h3>
                  <div className="space-y-3">
                    {[
                      { q: "Is this product true to size?", a: "Yes, our products are designed to fit true to size. If you are between sizes, we recommend sizing up for a more comfortable fit." },
                      { q: "How long does shipping take?", a: "Standard shipping takes 3-5 business days. Express shipping (1-2 business days) is available at checkout for an additional fee." },
                      { q: "Can I return this product?", a: "Absolutely. We offer a 30-day return policy. Items must be in original condition with tags attached for a full refund." },
                      { q: "Do you ship internationally?", a: "Yes, we ship to most countries. International shipping typically takes 7-14 business days depending on your location." },
                    ].map((faq, i) => (
                      <details key={i} className="group bg-gray-50 rounded-xl overflow-hidden">
                        <summary className="flex items-center justify-between px-4 py-3 cursor-pointer font-medium text-gray-900 text-sm list-none">
                          {faq.q}
                          <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                          </svg>
                        </summary>
                        <div className="px-4 pb-3 text-sm text-gray-600">{faq.a}</div>
                      </details>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Reviews tab */}
            {activeTab === "reviews" && (
              <ReviewsSection productId={product.id} />
            )}
          </div>
        </div>

        {/* Similar products section */}
        <SimilarProducts
         
          product={product}
          currency={currencyObj}
          lang={lang}
        />
      </div>

      {/* JSON-LD structured data for SEO/AEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: product.name,
            description: product.meta_description || product.description?.slice(0, 300) || "",
            image: [product.og_image || product.image_url].filter(Boolean),
            sku: product.sku,
            brand: { "@type": "Brand", name: bootstrap.store_name || "TruCommerce" },
            ...(product.rating > 0 ? {
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: product.rating,
                bestRating: 5,
                worstRating: 1,
              },
            } : {}),
            offers: {
              "@type": "Offer",
              price: (product.discounted_price || product.effective_price || product.base_price).toFixed(2),
              priceCurrency: product.currency_code || "USD",
              availability: (product.stock > 0 || (product.variants || []).some((v) => (v.stock ?? 0) > 0))
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
              url: `/products/${params.slug}`,
            },
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `` },
              ...(product.category_slug ? [{ "@type": "ListItem", position: 2, name: product.category_slug, item: `/?category=${product.category_slug}` }] : []),
              { "@type": "ListItem", position: product.category_slug ? 3 : 2, name: product.name, item: `/products/${params.slug}` },
            ],
          }),
        }}
      />
    </div>
  );
}
