"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Dot } from "lucide-react";
import { fetchBootstrap } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { FullPageLoader } from "@/components/Loaders";
import { useCurrencyLang } from "@/lib/currency-lang";

function FailedContent() {
  const searchParams = useSearchParams();
  const errorMessage = searchParams.get("error") || "Your payment could not be processed. Please try again.";
  const { currency, setCurrency, lang, setLang } = useCurrencyLang();

  const bootstrapQ = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => fetchBootstrap(),
  });

  const bootstrap = bootstrapQ.data;

  if (bootstrapQ.isLoading) {
    return <FullPageLoader label="Loading" />;
  }

  return (
    <div className="min-h-screen">
      {bootstrap && (
        <Header
         
          bootstrap={bootstrap}
          currency={currency}
          setCurrency={setCurrency}
          lang={lang}
          setLang={setLang}
        />
      )}

      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Failed banner */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-rose-100 mb-4 relative">
            <div className="absolute inset-0 rounded-full bg-rose-200 animate-ping opacity-30" />
            <svg className="w-12 h-12 text-rose-600 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Payment Failed</h1>
          <p className="text-gray-500 text-lg">We couldn't process your payment. Your cart has been preserved.</p>
        </div>

        {/* Error details card */}
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 mb-6">
          <h3 className="font-bold text-rose-900 mb-2 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            Error Details
          </h3>
          <p className="text-sm text-rose-700 bg-white/60 rounded-lg p-3 font-mono">{errorMessage}</p>
        </div>

        {/* Reassurance */}
        <div className="bg-white border rounded-2xl p-6 mb-6">
          <h3 className="font-bold text-gray-900 mb-3">Don't worry — your cart is safe</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              <p>Your cart items have been preserved. You won't need to add them again.</p>
            </div>
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              <p>Your delivery information is still saved for a faster retry.</p>
            </div>
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              <p>No charges have been made to your payment method.</p>
            </div>
          </div>
        </div>

        {/* Troubleshooting tips */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-6">
          <h3 className="font-bold text-amber-900 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            Common Solutions
          </h3>
          <ul className="space-y-2 text-sm text-amber-800">
            <li className="flex items-start gap-2">
              <Dot className="text-amber-500 w-5 h-5 flex-shrink-0" />
              <span>Check that your card details are correct and the card hasn't expired.</span>
            </li>
            <li className="flex items-start gap-2">
              <Dot className="text-amber-500 w-5 h-5 flex-shrink-0" />
              <span>Ensure you have sufficient funds available.</span>
            </li>
            <li className="flex items-start gap-2">
              <Dot className="text-amber-500 w-5 h-5 flex-shrink-0" />
              <span>Try a different payment method or card.</span>
            </li>
            <li className="flex items-start gap-2">
              <Dot className="text-amber-500 w-5 h-5 flex-shrink-0" />
              <span>Contact your bank if the issue persists.</span>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href={`/checkout`}
            className="flex-1 bg-rose-600 text-white font-semibold py-2.5 rounded-lg text-center hover:bg-rose-700 transition shadow-md flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992M2.985 19.644v-4.992M19.644 2.985l-3.232 3.232M5.376 18.624l3.232-3.232M9.348 16.023v4.992M19.644 2.985H14.652M2.985 14.652V9.348" />
            </svg>
            Try Again
          </Link>
          <Link
            href={`/cart`}
            className="flex-1 border font-semibold py-2.5 rounded-lg text-center hover:bg-gray-50 transition text-gray-700 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.484M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
            </svg>
            Back to Cart
          </Link>
        </div>

        {/* Contact support */}
        <div className="text-center mt-8 text-sm text-gray-400">
          <p>
            Need help?{" "}
            <a href="mailto:support@example.com" className="text-brand hover:underline">
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function FailedPage({ params }: { params: {} }) {
  return (
    <Suspense fallback={<FullPageLoader label="Loading" />}>
      <FailedContent />
    </Suspense>
  );
}
