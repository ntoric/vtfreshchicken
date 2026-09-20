"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Star, ChevronDown, Mail, MapPin, Truck, RotateCcw, ShieldCheck, Package,
  Users, Globe, HelpCircle,
} from "lucide-react";
import { fetchProducts, fetchBootstrap } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";
import type { PageBlock, Product, Currency, Category } from "@/types";

const ICON_MAP: Record<string, any> = {
  Truck, RotateCcw, ShieldCheck, Package, Users, Globe, Star, Mail, MapPin, HelpCircle,
};

export function BlockRenderer({
  block,
  tenant,
  currency,
}: {
  block: PageBlock;
  tenant: string;
  currency?: Currency;
}) {
  const p = block.props;

  switch (block.type) {
    case "hero":
      return <HeroBlock props={p} tenant={tenant} />;
    case "rich_text":
      return <RichTextBlock props={p} />;
    case "image":
      return <ImageBlock props={p} />;
    case "gallery":
      return <GalleryBlock props={p} />;
    case "cta":
      return <CTABlock props={p} />;
    case "spacer":
      return <div style={{ height: p.height || 48 }} />;
    case "divider":
      return <hr style={{ borderStyle: p.style || "solid", borderColor: p.color || "#e5e7eb", borderWidth: 0, borderTopWidth: 1 }} className="my-4" />;
    case "banner":
      return <BannerBlock props={p} />;
    case "featured_products":
      return <FeaturedProductsBlock props={p} tenant={tenant} currency={currency} />;
    case "category_showcase":
      return <CategoryShowcaseBlock props={p} tenant={tenant} />;
    case "product_carousel":
      return <ProductCarouselBlock props={p} tenant={tenant} currency={currency} />;
    case "testimonials":
      return <TestimonialsBlock props={p} />;
    case "reviews":
      return <ReviewsBlock props={p} tenant={tenant} />;
    case "faq":
      return <FAQBlock props={p} />;
    case "contact_form":
      return <ContactFormBlock props={p} tenant={tenant} />;
    case "map":
      return <MapBlock props={p} />;
    case "team":
      return <TeamBlock props={p} />;
    case "stats":
      return <StatsBlock props={p} />;
    case "timeline":
      return <TimelineBlock props={p} />;
    case "columns":
      return <ColumnsBlock props={p} />;
    case "feature_grid":
      return <FeatureGridBlock props={p} />;
    case "custom_html":
      return <CustomHtmlBlock props={p} />;
    case "footer":
      return <FooterBlock props={p} />;
    default:
      return null;
  }
}

function HeroBlock({ props: p, tenant }: { props: any; tenant: string }) {
  return (
    <section
      className="relative flex items-center justify-center text-center py-20 px-4"
      style={{
        backgroundColor: p.backgroundColor || "#4f46e5",
        color: p.textColor || "#fff",
        backgroundImage: p.backgroundImage ? `url(${p.backgroundImage})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {p.backgroundImage && <div className="absolute inset-0 bg-black/30" />}
      <div className={`relative max-w-3xl ${p.align === "left" ? "text-left" : "text-center"}`}>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">{p.title}</h1>
        {p.subtitle && <p className="text-lg sm:text-xl opacity-90 mb-6">{p.subtitle}</p>}
        {p.buttonText && (
          <Link
            href={p.buttonLink || `/${tenant}?view=shop`}
            className="inline-block bg-white/20 hover:bg-white/30 backdrop-blur-sm px-6 py-2.5 rounded-lg font-semibold transition"
          >
            {p.buttonText}
          </Link>
        )}
      </div>
    </section>
  );
}

function RichTextBlock({ props: p }: { props: any }) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="prose prose-lg max-w-none" dangerouslySetInnerHTML={{ __html: p.content || "" }} />
    </div>
  );
}

function ImageBlock({ props: p }: { props: any }) {
  if (!p.src) return null;
  return (
    <div className="px-4 py-6">
      <div className={p.width === "contained" ? "max-w-3xl mx-auto" : ""}>
        <img
          src={p.src}
          alt={p.alt || ""}
          className={`w-full ${p.rounded ? "rounded-xl" : ""}`}
        />
        {p.caption && <p className="text-sm text-gray-400 text-center mt-2">{p.caption}</p>}
      </div>
    </div>
  );
}

function GalleryBlock({ props: p }: { props: any }) {
  const images: string[] = p.images || [];
  if (images.length === 0) return null;
  return (
    <div className="px-4 py-6">
      {p.title && <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">{p.title}</h2>}
      <div className={`grid grid-cols-2 sm:grid-cols-${Math.min(p.columns || 3, 4)} gap-4`}>
        {images.map((img, i) => (
          <div key={i} className="aspect-square rounded-xl overflow-hidden bg-gray-100">
            <img src={img} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CTABlock({ props: p }: { props: any }) {
  return (
    <div className="px-4 py-8">
      <div
        className="max-w-4xl mx-auto rounded-xl p-10 text-center"
        style={{ backgroundColor: p.backgroundColor || "#4f46e5", color: p.textColor || "#fff" }}
      >
        <h2 className="text-2xl font-bold mb-4">{p.title}</h2>
        {p.buttonText && (
          <Link
            href={p.buttonLink || "#"}
            className="inline-block bg-white/20 hover:bg-white/30 px-6 py-2.5 rounded-lg font-semibold transition"
          >
            {p.buttonText}
          </Link>
        )}
      </div>
    </div>
  );
}

function BannerBlock({ props: p }: { props: any }) {
  return (
    <div className="px-4 py-4">
      <div
        className="max-w-6xl mx-auto rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4"
        style={{ backgroundColor: p.backgroundColor || "#f59e0b", color: p.textColor || "#fff" }}
      >
        <div>
          <h3 className="font-bold text-lg">{p.title}</h3>
          {p.subtitle && <p className="text-sm opacity-90">{p.subtitle}</p>}
        </div>
        {p.buttonText && (
          <Link
            href={p.buttonLink || "#"}
            className="inline-block bg-white/20 hover:bg-white/30 px-5 py-2 rounded-lg font-semibold transition whitespace-nowrap"
          >
            {p.buttonText}
          </Link>
        )}
      </div>
    </div>
  );
}

function FeaturedProductsBlock({ props: p, tenant, currency }: { props: any; tenant: string; currency?: Currency }) {
  const source = p.source || "featured";
  const queryKey = ["featured-products", tenant, source, p.category, p.limit, (p.product_ids || []).join(",")];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => {
      if (source === "selected" && (p.product_ids || []).length > 0) {
        return fetchProducts(tenant, { product_ids: p.product_ids, limit: p.product_ids.length });
      }
      if (source === "category" && p.category) {
        return fetchProducts(tenant, { category: p.category, limit: p.limit || 8 });
      }
      if (source === "all") {
        return fetchProducts(tenant, { limit: p.limit || 8 });
      }
      // default: featured
      return fetchProducts(tenant, { limit: p.limit || 8, featured: true });
    },
  });
  const products: Product[] = data?.items || [];
  if (isLoading) return <div className="py-12 text-center text-gray-400">Loading products...</div>;
  if (products.length === 0) return null;
  return (
    <div className="px-4 py-8">
      {p.title && <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">{p.title}</h2>}
      <div className={`grid grid-cols-2 sm:grid-cols-${Math.min(p.columns || 4, 4)} gap-4 max-w-6xl mx-auto`}>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} tenant={tenant} currency={currency} />
        ))}
      </div>
    </div>
  );
}

function CategoryShowcaseBlock({ props: p, tenant }: { props: any; tenant: string }) {
  const source = p.source || "all";
  const { data, isLoading } = useQuery({
    queryKey: ["bootstrap", tenant],
    queryFn: () => fetchBootstrap(tenant),
  });

  if (isLoading) return <div className="py-12 text-center text-gray-400">Loading categories...</div>;

  let categories: Category[] = (data?.categories || []).filter((c) => c.is_active);

  if (source === "selected" && (p.category_ids || []).length > 0) {
    categories = categories.filter((c) => p.category_ids.includes(c.id));
  } else {
    categories = categories.slice(0, p.limit || 6);
  }

  if (categories.length === 0) return null;

  const cols = Math.min(p.columns || 3, 6);

  return (
    <div className="px-4 py-8">
      {p.title && <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">{p.title}</h2>}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 max-w-6xl mx-auto" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${100 / cols}%, 1fr))` }}>
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/${tenant}?category=${cat.slug}`}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-50 to-slate-100 border border-slate-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-3 group-hover:bg-indigo-200 transition-colors">
                <Package className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{cat.name}</h3>
              {cat.description && (
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{cat.description}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ProductCarouselBlock({ props: p, tenant, currency }: { props: any; tenant: string; currency?: Currency }) {
  const source = p.source || "all";
  const queryKey = ["carousel-products", tenant, source, p.category, p.limit, (p.product_ids || []).join(",")];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => {
      if (source === "selected" && (p.product_ids || []).length > 0) {
        return fetchProducts(tenant, { product_ids: p.product_ids, limit: p.product_ids.length });
      }
      if (source === "category" && p.category) {
        return fetchProducts(tenant, { category: p.category, limit: p.limit || 10 });
      }
      if (source === "featured") {
        return fetchProducts(tenant, { limit: p.limit || 10, featured: true });
      }
      // default: all
      return fetchProducts(tenant, { limit: p.limit || 10 });
    },
  });
  const products: Product[] = data?.items || [];
  if (isLoading) return <div className="py-12 text-center text-gray-400">Loading...</div>;
  if (products.length === 0) return null;
  return (
    <div className="px-4 py-8">
      {p.title && <h2 className="text-2xl font-bold text-gray-900 mb-6">{p.title}</h2>}
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
        {products.map((product) => (
          <div key={product.id} className="w-48 sm:w-56 flex-shrink-0">
            <ProductCard product={product} tenant={tenant} currency={currency} />
          </div>
        ))}
      </div>
    </div>
  );
}

function TestimonialsBlock({ props: p }: { props: any }) {
  const items: any[] = p.items || [];
  if (items.length === 0) return null;
  return (
    <div className="px-4 py-8 bg-gray-50">
      {p.title && <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">{p.title}</h2>}
      <div className="grid grid-cols-1 sm:grid-cols-2 max-w-4xl mx-auto gap-6">
        {items.map((item, i) => (
          <div key={i} className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex gap-1 mb-3">
              {Array.from({ length: item.rating || 5 }).map((_, j) => (
                <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="text-gray-600 mb-3">&ldquo;{item.text}&rdquo;</p>
            <p className="text-sm font-medium text-gray-700">— {item.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewsBlock({ props: p, tenant }: { props: any; tenant: string }) {
  return (
    <div className="px-4 py-8">
      {p.title && <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">{p.title}</h2>}
      <div className="text-center text-gray-400">Customer reviews will appear here</div>
    </div>
  );
}

function FAQBlock({ props: p }: { props: any }) {
  const items: any[] = p.items || [];
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  if (items.length === 0) return null;
  return (
    <div className="px-4 py-8 max-w-3xl mx-auto">
      {p.title && <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">{p.title}</h2>}
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="border rounded-lg overflow-hidden">
            <button
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition"
            >
              <span className="font-medium text-gray-900">{item.question}</span>
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${openIdx === i ? "rotate-180" : ""}`} />
            </button>
            {openIdx === i && (
              <div className="px-4 pb-4 text-gray-600">{item.answer}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ContactFormBlock({ props: p, tenant }: { props: any; tenant: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });

  const fields = p.fields || { name: true, email: true, phone: false, subject: true, message: true };
  const inputCls = "w-full border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-brand focus:outline-none";
  const bgStyle = p.backgroundColor && p.backgroundColor !== "#ffffff" ? { backgroundColor: p.backgroundColor } : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/t/${tenant}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || "Failed to submit form");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit form");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-4 py-8 max-w-2xl mx-auto" style={bgStyle}>
      {p.title && <h2 className="text-2xl font-bold text-gray-900 mb-2">{p.title}</h2>}
      {p.subtitle && <p className="text-gray-500 mb-6">{p.subtitle}</p>}
      {submitted ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 text-center">
          <p className="text-emerald-700 font-medium">{p.successMessage || "Thank you! Your message has been sent."}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {(fields.name || fields.email) && (
            <div className="grid grid-cols-2 gap-4">
              {fields.name && (
                <input
                  type="text"
                  placeholder="Your name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputCls}
                />
              )}
              {fields.email && (
                <input
                  type="email"
                  placeholder="Your email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={inputCls}
                />
              )}
            </div>
          )}
          {fields.phone && (
            <input
              type="tel"
              placeholder="Your phone number"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className={inputCls}
            />
          )}
          {fields.subject && (
            <input
              type="text"
              placeholder="Subject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className={inputCls}
            />
          )}
          {fields.message && (
            <textarea
              placeholder="Your message"
              rows={5}
              required
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className={inputCls}
            />
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="bg-brand text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-brand-dark transition disabled:opacity-50"
          >
            {submitting ? "Sending..." : (p.buttonText || "Send Message")}
          </button>
        </form>
      )}
    </div>
  );
}

function MapBlock({ props: p }: { props: any }) {
  return (
    <div className="px-4 py-8">
      {p.title && <h2 className="text-2xl font-bold text-gray-900 mb-4">{p.title}</h2>}
      <div className="bg-gray-100 rounded-xl h-64 flex items-center justify-center text-gray-400">
        <div className="text-center">
          <MapPin className="w-12 h-12 mx-auto mb-2" />
          <p>{p.address || "Address not set"}</p>
        </div>
      </div>
    </div>
  );
}

function TeamBlock({ props: p }: { props: any }) {
  const members: any[] = p.members || [];
  if (members.length === 0) return null;
  return (
    <div className="px-4 py-8">
      {p.title && <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">{p.title}</h2>}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
        {members.map((m, i) => (
          <div key={i} className="text-center">
            <div className="w-24 h-24 rounded-full bg-gray-100 overflow-hidden mx-auto mb-3">
              {m.image ? <img src={m.image} alt={m.name} className="w-full h-full object-cover" /> : null}
            </div>
            <p className="font-semibold text-gray-900">{m.name}</p>
            <p className="text-sm text-gray-500">{m.role}</p>
            {m.bio && <p className="text-sm text-gray-400 mt-1">{m.bio}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsBlock({ props: p }: { props: any }) {
  const items: any[] = p.items || [];
  if (items.length === 0) return null;
  return (
    <div className="px-4 py-12 bg-gray-50">
      {p.title && <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">{p.title}</h2>}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 max-w-4xl mx-auto text-center">
        {items.map((item, i) => {
          const Icon = ICON_MAP[item.icon] || Star;
          return (
            <div key={i}>
              <Icon className="w-8 h-8 mx-auto mb-2 text-brand" />
              <p className="text-3xl font-bold text-gray-900">{item.value}</p>
              <p className="text-sm text-gray-500">{item.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimelineBlock({ props: p }: { props: any }) {
  const items: any[] = p.items || [];
  if (items.length === 0) return null;
  return (
    <div className="px-4 py-8 max-w-3xl mx-auto">
      {p.title && <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">{p.title}</h2>}
      <div className="space-y-6">
        {items.map((item, i) => (
          <div key={i} className="flex gap-4">
            <div className="flex-shrink-0 w-16 text-right">
              <span className="text-lg font-bold text-brand">{item.year}</span>
            </div>
            <div className="border-l-2 border-gray-200 pl-6 pb-6">
              <p className="font-semibold text-gray-900">{item.title}</p>
              <p className="text-gray-500 text-sm mt-1">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ColumnsBlock({ props: p }: { props: any }) {
  const items: any[] = p.items || [];
  if (items.length === 0) return null;
  return (
    <div className="px-4 py-6 max-w-5xl mx-auto">
      <div className={`grid grid-cols-1 sm:grid-cols-${p.columns || 2} gap-${p.gap || 4}`}>
        {items.map((item, i) => (
          <div key={i} className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: item.content || "" }} />
        ))}
      </div>
    </div>
  );
}

function FeatureGridBlock({ props: p }: { props: any }) {
  const features: any[] = p.features || [];
  if (features.length === 0) return null;
  return (
    <div className="px-4 py-8">
      {p.title && <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">{p.title}</h2>}
      <div className={`grid grid-cols-1 sm:grid-cols-${p.columns || 3} gap-8 max-w-5xl mx-auto`}>
        {features.map((f, i) => {
          const Icon = ICON_MAP[f.icon] || Package;
          return (
            <div key={i} className="text-center">
              <div className="w-14 h-14 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon className="w-7 h-7 text-brand" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
              <p className="text-sm text-gray-500">{f.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CustomHtmlBlock({ props: p }: { props: any }) {
  const html = p.html || "";
  const css = p.css || "";
  const js = p.js || "";
  const height = p.height || 300;

  if (!html && !css && !js) return null;

  // Build a complete HTML document for the iframe srcdoc.
  // The sandbox="allow-scripts" attribute provides encapsulation:
  //   - JS runs in a unique origin, cannot access parent DOM or cookies
  //   - CSS is scoped to the iframe, cannot leak to or from the parent
  //   - No allow-same-origin: the iframe cannot read parent page data
  const srcdoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
${css}
</style>
</head>
<body>
${html}
<script>
try {
${js}
} catch(e) { console.error('Custom widget error:', e); }
<\/script>
</body>
</html>`;

  return (
    <div className="px-4 py-8">
      {p.title && <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">{p.title}</h2>}
      <iframe
        srcDoc={srcdoc}
        sandbox="allow-scripts"
        className="w-full border-0 rounded-lg"
        style={{ height: `${height}px` }}
        title={p.title || "Custom content"}
        loading="lazy"
      />
    </div>
  );
}

function FooterBlock({ props: p }: { props: any }) {
  const cols: any[] = p.columns || [];
  const social = p.social || {};
  const bg = p.backgroundColor || "#1e293b";
  const fg = p.textColor || "#cbd5e1";

  const socialLinks: { key: string; label: string; href: string }[] = [
    { key: "facebook", label: "Facebook", href: social.facebook || "" },
    { key: "twitter", label: "Twitter", href: social.twitter || "" },
    { key: "instagram", label: "Instagram", href: social.instagram || "" },
    { key: "youtube", label: "YouTube", href: social.youtube || "" },
    { key: "linkedin", label: "LinkedIn", href: social.linkedin || "" },
  ].filter((s) => s.href);

  return (
    <footer className="px-4 py-10" style={{ backgroundColor: bg, color: fg }}>
      <div className="max-w-6xl mx-auto">
        {/* Link columns */}
        {cols.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 mb-8">
            {cols.map((col, i) => (
              <div key={i}>
                <h3 className="font-semibold text-white text-sm mb-3">{col.title}</h3>
                <ul className="space-y-2">
                  {(col.links || []).map((link: any, j: number) => (
                    <li key={j}>
                      <a href={link.url} className="text-sm hover:text-white transition-colors" style={{ color: fg }}>
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {/* Social + payment row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t pt-6" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          {/* Social icons */}
          {p.showSocial !== false && socialLinks.length > 0 && (
            <div className="flex items-center gap-3">
              {socialLinks.map((s) => (
                <a
                  key={s.key}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-white/20"
                  style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                >
                  <SocialIcon name={s.key} />
                </a>
              ))}
            </div>
          )}

          {/* Payment badges */}
          {p.showPayment !== false && (
            <div className="flex items-center gap-2 flex-wrap">
              {["VISA", "MC", "AMEX", "PAYPAL", "G PAY"].map((pm) => (
                <span
                  key={pm}
                  className="text-xs font-bold px-2 py-1 rounded"
                  style={{ backgroundColor: "rgba(255,255,255,0.1)", color: fg }}
                >
                  {pm}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Copyright */}
        {p.copyright && (
          <div className="text-center text-xs mt-6 opacity-60">
            {p.copyright}
          </div>
        )}
      </div>
    </footer>
  );
}

function SocialIcon({ name }: { name: string }) {
  // Simple inline SVG social icons (24x24, currentColor)
  const icons: Record<string, string> = {
    facebook: "M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.97h-1.52c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z",
    twitter: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
    instagram: "M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.43.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.43.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.72 3.72 0 01-1.38-.9 3.72 3.72 0 01-.9-1.38c-.16-.43-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.43-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zm0 1.62c-3.15 0-3.5.01-4.74.07-.9.04-1.39.19-1.71.32-.43.17-.74.37-1.06.69-.32.32-.52.63-.69 1.06-.13.32-.28.81-.32 1.71-.06 1.24-.07 1.59-.07 4.74s.01 3.5.07 4.74c.04.9.19 1.39.32 1.71.17.43.37.74.69 1.06.32.32.63.52 1.06.69.32.13.81.28 1.71.32 1.24.06 1.59.07 4.74.07s3.5-.01 4.74-.07c.9-.04 1.39-.19 1.71-.32.43-.17.74-.37 1.06-.69.32-.32.52-.63.69-1.06.13-.32.28-.81.32-1.71.06-1.24.07-1.59.07-4.74s-.01-3.5-.07-4.74c-.04-.9-.19-1.39-.32-1.71a2.85 2.85 0 00-.69-1.06 2.85 2.85 0 00-1.06-.69c-.32-.13-.81-.28-1.71-.32-1.24-.06-1.59-.07-4.74-.07zm0 2.76a5.46 5.46 0 100 10.92 5.46 5.46 0 000-10.92zm0 9a3.54 3.54 0 110-7.08 3.54 3.54 0 010 7.08zm6.95-9.22a1.28 1.28 0 11-2.55 0 1.28 1.28 0 012.55 0z",
    youtube: "M23.5 6.2a3.02 3.02 0 00-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.51A3.02 3.02 0 00.5 6.2C0 8.08 0 12 0 12s0 3.92.5 5.8a3.02 3.02 0 002.12 2.14c1.88.51 9.38.51 9.38.51s7.5 0 9.38-.51a3.02 3.02 0 002.12-2.14C24 15.92 24 12 24 12s0-3.92-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z",
    linkedin: "M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 110-4.13 2.06 2.06 0 010 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z",
  };
  const path = icons[name];
  if (!path) return null;
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}
