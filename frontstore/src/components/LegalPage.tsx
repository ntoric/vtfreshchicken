"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { ShieldCheck, Scale, Cookie, Database, Clock, ArrowUpRight, FileText } from "lucide-react";
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

const RELATED_DOCS = [
  {
    href: "/privacy-policy",
    label: "Privacy Policy",
    desc: "How we collect & use your data",
    icon: ShieldCheck,
  },
  {
    href: "/terms",
    label: "Terms & Conditions",
    desc: "The rules of using our store",
    icon: Scale,
  },
  {
    href: "/cookie-policy",
    label: "Cookie Policy",
    desc: "Cookies & tracking choices",
    icon: Cookie,
  },
  {
    href: "/account/data",
    label: "Your Data & Privacy",
    desc: "Export or delete your data",
    icon: Database,
  },
];

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
  const contentRef = useRef<HTMLDivElement>(null);
  const [sections, setSections] = useState<{ id: string; label: string }[]>([]);
  const [activeId, setActiveId] = useState("");

  // Build a table of contents from the rendered <h2> sections and track scroll position
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const heads = Array.from(root.querySelectorAll("h2"));
    heads.forEach((h, i) => {
      if (!h.id) h.id = `legal-section-${i + 1}`;
      h.style.scrollMarginTop = "110px";
    });
    setSections(heads.map((h) => ({ id: h.id, label: h.textContent || "" })));

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }
      },
      { rootMargin: "-110px 0px -70% 0px" }
    );
    heads.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [children]);

  return (
    <div className="min-h-screen bg-[#FBF9F6]">
      <Header
        bootstrap={bootstrap}
        currency={currency}
        setCurrency={setCurrency}
        lang={lang}
        setLang={setLang}
      />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-stone-200/70 bg-gradient-to-b from-[#FAF0EB] via-[#FBF6F2] to-[#FBF9F6]">
        <div
          aria-hidden
          className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-[0.07] blur-3xl"
          style={{ backgroundColor: "var(--brand-color, #C9232C)" }}
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-12 sm:pt-20 sm:pb-16">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-brand">
            <FileText className="w-3.5 h-3.5" strokeWidth={2} />
            Legal
          </span>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-stone-900 mt-4">
            {title}
          </h1>
          <div className="mt-6">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 bg-white/70 border border-stone-200 rounded-full px-3 py-1.5">
              <Clock className="w-3.5 h-3.5 text-stone-400" strokeWidth={2} />
              Last updated: {lastUpdated}
            </span>
          </div>
        </div>
      </section>

      {/* Content + sticky TOC */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
        <div className="lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-16">
          {sections.length > 1 && (
            <aside className="hidden lg:block">
              <div className="sticky top-28">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400 mb-4">
                  On this page
                </p>
                <nav className="flex flex-col">
                  {sections.map((s) => (
                    <button
                      key={s.id}
                      onClick={() =>
                        document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" })
                      }
                      className={`-ml-px border-l-2 pl-4 py-1.5 text-left text-[13px] leading-snug transition-colors ${
                        activeId === s.id
                          ? "border-brand text-stone-900 font-semibold"
                          : "border-stone-200 text-stone-500 hover:text-stone-800 hover:border-stone-300"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </nav>
              </div>
            </aside>
          )}

          <div
            ref={contentRef}
            className="prose prose-slate max-w-none prose-headings:font-display prose-headings:tracking-tight prose-h2:text-2xl prose-h2:font-semibold prose-h2:text-stone-900 prose-h2:mt-12 prose-h2:first:mt-0 prose-h3:text-lg prose-h3:text-stone-800 prose-p:text-stone-600 prose-p:leading-relaxed prose-li:text-stone-600 prose-li:marker:text-brand prose-strong:text-stone-900 prose-a:text-brand prose-a:font-medium prose-a:no-underline hover:prose-a:underline"
          >
            {children}
          </div>
        </div>

        {/* Related documents */}
        <div className="mt-16 pt-10 border-t border-stone-200">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400 mb-5">
            Related documents
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {RELATED_DOCS.map((doc) => (
              <Link
                key={doc.href}
                href={doc.href}
                className="group flex items-center gap-4 rounded-2xl border border-stone-200 bg-white px-5 py-4 hover:border-brand hover:shadow-sm transition-all"
              >
                <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-light text-brand flex-shrink-0">
                  <doc.icon className="w-5 h-5" strokeWidth={1.8} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-stone-900">{doc.label}</span>
                  <span className="block text-xs text-stone-400 mt-0.5">{doc.desc}</span>
                </span>
                <ArrowUpRight className="w-4 h-4 text-stone-300 group-hover:text-brand group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-stone-200 mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 text-sm text-stone-400 flex flex-col md:flex-row justify-between gap-4">
          <p>© {new Date().getFullYear()} {bootstrap.store_name}. Powered by TruCommerce.</p>
          <div className="flex gap-5">
            <Link href={`/privacy-policy`} className="hover:text-stone-700 transition-colors">Privacy</Link>
            <Link href={`/cookie-policy`} className="hover:text-stone-700 transition-colors">Cookies</Link>
            <Link href={`/terms`} className="hover:text-stone-700 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
