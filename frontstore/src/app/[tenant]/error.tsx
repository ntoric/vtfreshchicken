"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function TenantError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Storefront error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center py-20">
      <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center mb-5">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
      <p className="text-gray-500 max-w-md mb-2">
        We couldn't load this page. Please try again.
      </p>
      {error?.message && (
        <pre className="text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-2 mt-3 max-w-md overflow-x-auto">
          {error.message}
        </pre>
      )}
      <div className="flex gap-3 mt-6">
        <button
          onClick={reset}
          className="text-white px-5 py-2 rounded-lg text-sm font-medium transition hover:opacity-90"
          style={{ backgroundColor: "var(--brand-color)" }}
        >
          Try again
        </button>
        <Link
          href="."
          className="border border-gray-300 text-gray-700 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 transition"
        >
          Back to store
        </Link>
      </div>
    </div>
  );
}
