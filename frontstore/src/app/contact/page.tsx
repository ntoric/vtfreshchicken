"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail, Phone, MapPin, Package, Send, CheckCircle2, MessageSquareText, Clock, AlertCircle } from "lucide-react";
import { fetchBootstrap, fetchStoreInfo, submitContactForm } from "@/lib/api";
import { Header } from "@/components/Header";
import { StorefrontSkeleton } from "@/components/Loaders";
import { useCurrencyLang } from "@/lib/currency-lang";

const SUBJECTS = [
  "Order & delivery",
  "Product quality",
  "Feedback & suggestions",
  "Bulk / wholesale enquiry",
  "Something else",
];

const inputCls =
  "w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand transition";

export default function ContactPage({ params }: { params: {} }) {
  const { currency, setCurrency, lang, setLang } = useCurrencyLang();

  const bootstrapQ = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => fetchBootstrap(),
  });

  const infoQ = useQuery({
    queryKey: ["store-info"],
    queryFn: () => fetchStoreInfo(),
  });

  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: SUBJECTS[0], message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const tenant = infoQ.data?.tenant;
  const address = [tenant?.address, tenant?.city, tenant?.country].filter(Boolean).join(", ");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await submitContactForm(form);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (bootstrapQ.isLoading) return <StorefrontSkeleton />;
  if (bootstrapQ.error || !bootstrapQ.data) {
    return <div className="min-h-screen flex items-center justify-center text-rose-500">Failed to load. Please try again.</div>;
  }

  return (
    <div className="min-h-screen bg-[#FBF9F6]">
      <Header
        bootstrap={bootstrapQ.data}
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
            <MessageSquareText className="w-3.5 h-3.5" strokeWidth={2} />
            Get in touch
          </span>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-stone-900 mt-4">
            Contact us
          </h1>
          <p className="mt-4 text-base sm:text-lg text-stone-500 max-w-xl leading-relaxed">
            Questions about an order, delivery, or our products? Send us a message — we typically reply
            within one business day.
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
        <div className="grid lg:grid-cols-[360px_minmax(0,1fr)] gap-10 lg:gap-14 items-start">
          {/* Contact details */}
          <aside className="space-y-3">
            {tenant?.contact_email && (
              <a
                href={`mailto:${tenant.contact_email}`}
                className="group flex items-center gap-4 rounded-2xl border border-stone-200 bg-white px-5 py-4 hover:border-brand hover:shadow-sm transition-all"
              >
                <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-brand-light text-brand flex-shrink-0">
                  <Mail className="w-5 h-5" strokeWidth={1.8} />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-stone-400 uppercase tracking-wider">Email us</span>
                  <span className="block text-sm font-semibold text-stone-900 mt-0.5 truncate group-hover:text-brand transition-colors">
                    {tenant.contact_email}
                  </span>
                </span>
              </a>
            )}
            {tenant?.contact_phone && (
              <a
                href={`tel:${tenant.contact_phone}`}
                className="group flex items-center gap-4 rounded-2xl border border-stone-200 bg-white px-5 py-4 hover:border-brand hover:shadow-sm transition-all"
              >
                <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-brand-light text-brand flex-shrink-0">
                  <Phone className="w-5 h-5" strokeWidth={1.8} />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-stone-400 uppercase tracking-wider">Call us</span>
                  <span className="block text-sm font-semibold text-stone-900 mt-0.5 group-hover:text-brand transition-colors">
                    {tenant.contact_phone}
                  </span>
                </span>
              </a>
            )}
            {address && (
              <div className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white px-5 py-4">
                <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-brand-light text-brand flex-shrink-0">
                  <MapPin className="w-5 h-5" strokeWidth={1.8} />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-stone-400 uppercase tracking-wider">Find us</span>
                  <span className="block text-sm font-semibold text-stone-900 mt-0.5">{address}</span>
                </span>
              </div>
            )}
            <div className="flex items-center gap-4 rounded-2xl border border-stone-200 bg-white px-5 py-4">
              <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-brand-light text-brand flex-shrink-0">
                <Clock className="w-5 h-5" strokeWidth={1.8} />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-medium text-stone-400 uppercase tracking-wider">Response time</span>
                <span className="block text-sm font-semibold text-stone-900 mt-0.5">Within one business day</span>
              </span>
            </div>

            {/* Order help shortcut */}
            <Link
              href="/orders"
              className="group flex items-center justify-between gap-4 rounded-2xl border border-dashed border-stone-300 px-5 py-4 hover:border-brand transition-colors"
            >
              <span className="flex items-center gap-3">
                <Package className="w-5 h-5 text-stone-400 group-hover:text-brand transition-colors" strokeWidth={1.8} />
                <span className="text-sm font-medium text-stone-600 group-hover:text-stone-900 transition-colors">
                  Looking for an existing order?
                </span>
              </span>
              <span className="text-sm font-semibold text-brand whitespace-nowrap">View orders →</span>
            </Link>
          </aside>

          {/* Form */}
          <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6 sm:p-8">
            {submitted ? (
              <div className="py-10 text-center">
                <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 mb-5">
                  <CheckCircle2 className="w-8 h-8" strokeWidth={1.8} />
                </span>
                <h2 className="font-display text-2xl font-semibold text-stone-900">Message sent</h2>
                <p className="text-sm text-stone-500 mt-2 max-w-sm mx-auto leading-relaxed">
                  Thanks for reaching out — we've received your message and will get back to you within
                  one business day.
                </p>
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setForm({ name: "", email: "", phone: "", subject: SUBJECTS[0], message: "" });
                  }}
                  className="mt-6 text-sm font-semibold text-brand hover:underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <>
                <h2 className="font-display text-2xl font-semibold text-stone-900">Send us a message</h2>
                <p className="text-sm text-stone-400 mt-1 mb-6">
                  Fill in the form and our team will reply to your email.
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="contact-name" className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
                        Name <span className="text-brand">*</span>
                      </label>
                      <input
                        id="contact-name"
                        type="text"
                        required
                        placeholder="Your name"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label htmlFor="contact-email" className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
                        Email <span className="text-brand">*</span>
                      </label>
                      <input
                        id="contact-email"
                        type="email"
                        required
                        placeholder="you@example.com"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="contact-phone" className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
                        Phone <span className="text-stone-300 font-normal normal-case">(optional)</span>
                      </label>
                      <input
                        id="contact-phone"
                        type="tel"
                        placeholder="+91 ..."
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label htmlFor="contact-subject" className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
                        Topic
                      </label>
                      <select
                        id="contact-subject"
                        value={form.subject}
                        onChange={(e) => setForm({ ...form, subject: e.target.value })}
                        className={inputCls}
                      >
                        {SUBJECTS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="contact-message" className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
                      Message <span className="text-brand">*</span>
                    </label>
                    <textarea
                      id="contact-message"
                      required
                      rows={6}
                      placeholder="How can we help? Include your order number if it's about an order."
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      className={`${inputCls} resize-y`}
                    />
                  </div>

                  {error && (
                    <p className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3.5 rounded-full text-sm font-semibold text-white bg-brand hover:bg-brand-dark shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" strokeWidth={2} />
                    {submitting ? "Sending..." : "Send message"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-stone-200 mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 text-sm text-stone-400 flex flex-col md:flex-row justify-between gap-4">
          <p>© {new Date().getFullYear()} {bootstrapQ.data.store_name}. Powered by TruCommerce.</p>
          <div className="flex gap-5">
            <Link href="/privacy-policy" className="hover:text-stone-700 transition-colors">Privacy</Link>
            <Link href="/cookie-policy" className="hover:text-stone-700 transition-colors">Cookies</Link>
            <Link href="/terms" className="hover:text-stone-700 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
