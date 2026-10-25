"use client";

import Link from "next/link";
import { Header } from "@/components/Header";
import type { BootstrapResponse } from "@/types";

interface LegalPageProps {
  bootstrap: BootstrapResponse;
  currency: string;
  setCurrency: (c: string) => void;
  lang: string;
  setLang: (l: string) => void;
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}

export function LegalPage({
    bootstrap,
  currency,
  setCurrency,
  lang,
  setLang,
  title,
  lastUpdated,
  children,
}: LegalPageProps) {
  return (
    <div className="min-h-screen bg-white">
      <Header
       
        bootstrap={bootstrap}
        currency={currency}
        setCurrency={setCurrency}
        lang={lang}
        setLang={setLang}
      />

      {/* Hero */}
      <section className="bg-gradient-to-r from-brand-light to-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-10">
          <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-400 mt-2">Last updated: {lastUpdated}</p>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="prose prose-slate max-w-none prose-headings:text-gray-900 prose-headings:font-bold prose-a:text-brand prose-strong:text-gray-900 prose-p:text-gray-600 prose-li:text-gray-600">
          {children}
        </div>

        {/* Related links */}
        <div className="mt-12 pt-8 border-t">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Related Documents</h3>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/privacy-policy`}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 transition text-gray-600"
            >
              Privacy Policy
            </Link>
            <Link
              href={`/cookie-policy`}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 transition text-gray-600"
            >
              Cookie Policy
            </Link>
            <Link
              href={`/terms`}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 transition text-gray-600"
            >
              Terms of Service
            </Link>
            <Link
              href={`/account/data`}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 transition text-gray-600"
            >
              Your Data & Privacy
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 py-8 text-sm text-gray-400 flex flex-col md:flex-row justify-between gap-4">
          <p>© {new Date().getFullYear()} {bootstrap.store_name}. Powered by TruCommerce.</p>
          <div className="flex gap-4">
            <Link href={`/privacy-policy`} className="hover:text-gray-600">Privacy</Link>
            <Link href={`/cookie-policy`} className="hover:text-gray-600">Cookies</Link>
            <Link href={`/terms`} className="hover:text-gray-600">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
