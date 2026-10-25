"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchBootstrap, fetchStorePage } from "@/lib/api";
import { StorefrontSkeleton } from "@/components/Loaders";
import { BlockRenderer } from "@/components/BlockRenderer";
import { useCurrencyLang } from "@/lib/currency-lang";

export default function PrivacyPolicyPage({ params }: { params: {} }) {
  const { currency } = useCurrencyLang();

  const bootstrapQ = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => fetchBootstrap(),
  });

  const pageQ = useQuery({
    queryKey: ["store-page", "privacy-policy"],
    queryFn: () => fetchStorePage("privacy-policy"),
    retry: 1,
  });

  if (bootstrapQ.isLoading) return <StorefrontSkeleton />;
  if (bootstrapQ.error || !bootstrapQ.data) {
    return <div className="min-h-screen flex items-center justify-center text-rose-500">Failed to load. Please try again.</div>;
  }

  const currencyObj = bootstrapQ.data.currencies.find((c) => c.code === currency);

  return (
    <>
      {pageQ.isLoading ? (
        <div className="min-h-[50vh] flex items-center justify-center text-gray-400">Loading...</div>
      ) : pageQ.error || !pageQ.data ? (
        <div className="min-h-[50vh] flex flex-col items-center justify-center text-gray-400">
          <h1 className="text-3xl font-bold text-gray-700 mb-2">Page Not Found</h1>
        </div>
      ) : (
        <div className="min-h-screen">
          {pageQ.data.blocks.map((block) => (
            <BlockRenderer key={block.id} block={block} currency={currencyObj} />
          ))}
        </div>
      )}
    </>
  );
}
