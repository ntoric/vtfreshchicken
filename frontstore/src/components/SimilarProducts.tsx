"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchProducts } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";
import type { Currency, Product } from "@/types";

interface SimilarProductsProps {
  product: Product;
  currency?: Currency;
  lang?: string;
}

export function SimilarProducts({ product, currency, lang }: SimilarProductsProps) {
  // Fetch products in the same category, excluding the current product
  const similarQ = useQuery({
    queryKey: ["similar-products", product.id, product.category_slug, currency?.code, lang],
    queryFn: () =>
      fetchProducts({
        category: product.category_slug,
        exclude: product.id,
        limit: 8,
        currency: currency?.code,
      }, lang),
    enabled: !!product.category_slug,
  });

  const similarItems = similarQ.data?.items ?? [];

  // If no category-similar products, fall back to featured products
  const fallbackQ = useQuery({
    queryKey: ["featured-products", product.id, currency?.code, lang],
    queryFn: () =>
      fetchProducts({
        featured: true,
        exclude: product.id,
        limit: 8,
        currency: currency?.code,
      }, lang),
    enabled: !!product.category_slug && similarItems.length === 0 && !similarQ.isLoading,
  });

  const fallbackItems = fallbackQ.data?.items ?? [];
  const products = similarItems.length > 0 ? similarItems : fallbackItems;

  if (similarQ.isLoading || (similarItems.length === 0 && fallbackQ.isLoading)) {
    return (
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">You May Also Like</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
              <div className="aspect-square bg-gray-200" />
              <div className="p-4 space-y-2">
                <div className="h-3 bg-gray-200 rounded w-1/3" />
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-5 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return null; // Don't show the section if there are no similar products
  }

  const isFallback = similarItems.length === 0;

  return (
    <div className="mt-12">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {isFallback ? "Featured Products" : "You May Also Like"}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {isFallback
              ? "Hand-picked products just for you"
              : `More from ${product.category_slug?.replace(/-/g, " ")}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
           
            currency={currency}
          />
        ))}
      </div>
    </div>
  );
}
