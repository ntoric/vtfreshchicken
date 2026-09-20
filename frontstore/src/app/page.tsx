import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight, ShoppingBag, Store, Globe, CreditCard, Languages, BarChart3,
  Users, Shield, Zap, Layers, Palette, Truck, Star, CheckCircle2, Sparkles,
  TrendingUp, Package, Settings, Lock, Smartphone,
} from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-white overflow-x-hidden">
      {/* ===== Hero Section ===== */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 animate-gradient">
        {/* Floating decorative blobs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-300/20 rounded-full blur-3xl animate-float-delayed" />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-indigo-300/20 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }}
        />

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center text-white">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 backdrop-blur-md border border-white/20 mb-8 animate-slide-in-up">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">The Complete Ecommerce Platform</span>
          </div>

          {/* Heading */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight mb-6 animate-slide-in-up" style={{ animationDelay: "0.1s" }}>
            Build Your Store.
            <br />
            <span className="bg-gradient-to-r from-yellow-200 via-pink-200 to-indigo-200 bg-clip-text text-transparent">
              Scale Without Limits.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-white/90 max-w-3xl mx-auto mb-10 animate-slide-in-up" style={{ animationDelay: "0.2s" }}>
            A powerful, multicurrency, multilingual ecommerce platform with a beautiful storefront
            and a feature-rich backoffice. Everything you need to run and grow your online business.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-in-up" style={{ animationDelay: "0.3s" }}>
            <Link
              href="/demo"
              className="group px-8 py-4 rounded-2xl bg-white text-indigo-700 font-bold text-lg hover:bg-indigo-50 transition-all shadow-2xl hover:shadow-white/30 inline-flex items-center gap-2 hover:gap-3"
            >
              Visit Demo Store
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="/backoffice"
              className="px-8 py-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/30 font-bold text-lg hover:bg-white/20 transition-all shadow-lg inline-flex items-center gap-2"
            >
              <Settings className="w-5 h-5" />
              Backoffice
            </a>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-16 animate-fade-in" style={{ animationDelay: "0.5s" }}>
            {[
              { label: "Stores", value: "Unlimited" },
              { label: "Currencies", value: "Multi" },
              { label: "Languages", value: "Multi" },
              { label: "Roles", value: "4 Levels" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-2xl sm:text-3xl font-bold">{s.value}</p>
                <p className="text-sm text-white/70 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-float">
            <div className="w-6 h-10 rounded-full border-2 border-white/40 flex items-start justify-center p-1.5">
              <div className="w-1 h-2 bg-white/60 rounded-full" />
            </div>
          </div>
        </div>
      </section>

      {/* ===== Trusted By / Marquee ===== */}
      <section className="py-12 bg-slate-50 border-y border-slate-100 overflow-hidden">
        <div className="flex items-center gap-16 animate-marquee whitespace-nowrap">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex items-center gap-16">
              {["Multi-Store", "Multi-currency", "Multilingual", "Role-based Access", "Docker Ready", "Go + React", "PostgreSQL", "Redis Cache"].map((tag) => (
                <span key={tag} className="text-2xl font-bold text-slate-300 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                  {tag}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ===== Features Grid ===== */}
      <section className="py-24 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-indigo-600 font-semibold text-sm uppercase tracking-wider">Features</span>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 mt-3">
              Everything You Need to Sell
            </h2>
            <p className="text-lg text-slate-500 mt-4 max-w-2xl mx-auto">
              From product catalog to checkout, from inventory to analytics — TruCommerce has it all built in.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Store, title: "Multi-Store Architecture", desc: "Run unlimited isolated stores on a single platform. Each store gets its own catalog, settings, and staff.", color: "from-indigo-500 to-blue-500" },
              { icon: Package, title: "Rich Product Catalog", desc: "Products, variants, attributes, categories, images, reviews, wishlists — a complete catalog system.", color: "from-purple-500 to-pink-500" },
              { icon: CreditCard, title: "Multi-Currency", desc: "Support multiple currencies with live exchange rate conversion. Prices adapt automatically per customer.", color: "from-emerald-500 to-teal-500" },
              { icon: Languages, title: "Multilingual", desc: "Serve customers in their language. Product translations and language-aware storefront.", color: "from-orange-500 to-red-500" },
              { icon: Users, title: "Role-Based Access", desc: "Superadmin, business admin, staff, and customer roles with granular permission control.", color: "from-cyan-500 to-blue-500" },
              { icon: BarChart3, title: "Analytics Dashboard", desc: "Real-time stats for sales, orders, customers, revenue, and inventory — all in one place.", color: "from-violet-500 to-purple-500" },
              { icon: Truck, title: "Shipping & Tax", desc: "Flexible shipping methods, zones, rates. Tax classes, zones, and rates with automatic calculation.", color: "from-amber-500 to-orange-500" },
              { icon: Shield, title: "Secure by Design", desc: "JWT auth, Redis-backed refresh tokens, RBAC, store isolation, GDPR-ready data tools.", color: "from-rose-500 to-pink-500" },
              { icon: Smartphone, title: "Responsive Storefront", desc: "Mobile-first, beautiful storefront with infinite scroll, filters, and smooth UX.", color: "from-green-500 to-emerald-500" },
            ].map((f, i) => (
              <div
                key={f.title}
                className="group relative bg-white rounded-3xl border border-slate-100 p-8 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${f.color} opacity-0 group-hover:opacity-5 transition-opacity`} />
                <div className={`relative w-14 h-14 rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                  <f.icon className="w-7 h-7 text-white" strokeWidth={1.75} />
                </div>
                <h3 className="relative text-xl font-bold text-slate-900 mb-2">{f.title}</h3>
                <p className="relative text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Storefront Showcase ===== */}
      <section className="py-24 px-4 sm:px-6 bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 text-white overflow-hidden">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="animate-slide-in-left">
            <span className="text-indigo-400 font-semibold text-sm uppercase tracking-wider">Storefront</span>
            <h2 className="text-4xl sm:text-5xl font-extrabold mt-3 mb-6">
              A Storefront That
              <span className="block bg-gradient-to-r from-indigo-400 to-pink-400 bg-clip-text text-transparent">
                Converts Visitors
              </span>
            </h2>
            <p className="text-lg text-white/70 mb-8">
              Beautiful, fast, and responsive. Your customers get a premium shopping experience on any device.
            </p>
            <div className="space-y-4">
              {[
                { icon: ShoppingBag, text: "Infinite scroll product listings with grid/list views" },
                { icon: Layers, text: "Advanced filters by category, price, attributes" },
                { icon: Star, text: "Product reviews, ratings, and wishlists" },
                { icon: CreditCard, text: "Guest checkout and authenticated checkout flows" },
                { icon: Globe, text: "Per-store currency and language selection" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-indigo-300" />
                  </div>
                  <span className="text-white/80">{item.text}</span>
                </div>
              ))}
            </div>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 mt-8 px-5 py-2.5 rounded-lg bg-white text-indigo-700 font-semibold hover:bg-indigo-50 transition shadow-lg"
            >
              Explore Demo Store <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Mockup */}
          <div className="relative animate-slide-in-right">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-white/10">
              <div className="bg-white p-4">
                <div className="flex gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="space-y-4">
                  <div className="h-8 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-lg" />
                  <div className="grid grid-cols-3 gap-3">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="aspect-square bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* Floating cards */}
            <div className="absolute -top-6 -right-6 bg-white rounded-2xl shadow-xl p-4 animate-float">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Revenue</p>
                  <p className="text-lg font-bold text-slate-900">$12.4k</p>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-xl p-4 animate-float-delayed">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <Package className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Products</p>
                  <p className="text-lg font-bold text-slate-900">1,248</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Backoffice Showcase ===== */}
      <section className="py-24 px-4 sm:px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          {/* Mockup */}
          <div className="relative order-2 lg:order-1 animate-slide-in-left">
            <div className="rounded-2xl overflow-hidden shadow-2xl border border-slate-200">
              <div className="bg-slate-900 p-4">
                <div className="flex gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex gap-4">
                  <div className="w-40 space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-8 bg-white/10 rounded-lg" />
                    ))}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="h-20 bg-gradient-to-r from-indigo-500/30 to-purple-500/30 rounded-xl" />
                    <div className="grid grid-cols-3 gap-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-16 bg-white/5 rounded-xl" />
                      ))}
                    </div>
                    <div className="h-32 bg-white/5 rounded-xl" />
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -top-6 -left-6 bg-white rounded-2xl shadow-xl p-4 animate-float">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Orders Today</p>
                  <p className="text-lg font-bold text-slate-900">347</p>
                </div>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2 animate-slide-in-right">
            <span className="text-indigo-600 font-semibold text-sm uppercase tracking-wider">Backoffice</span>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 mt-3 mb-6">
              Manage Everything
              <span className="block bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                From One Dashboard
              </span>
            </h2>
            <p className="text-lg text-slate-500 mb-8">
              A comprehensive backoffice with modules for every aspect of your business.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: BarChart3, label: "Dashboard" },
                { icon: Package, label: "Products & Variants" },
                { icon: ShoppingBag, label: "Orders" },
                { icon: Users, label: "Customers" },
                { icon: CreditCard, label: "Payments & Refunds" },
                { icon: Truck, label: "Shipping" },
                { icon: Lock, label: "Tax" },
                { icon: Settings, label: "Settings" },
              ].map((m) => (
                <div key={m.label} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-100 hover:shadow-md transition">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <m.icon className="w-4 h-4 text-indigo-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">{m.label}</span>
                </div>
              ))}
            </div>
            <a
              href="/backoffice"
              className="inline-flex items-center gap-2 mt-8 px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition shadow-lg"
            >
              Open Backoffice <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ===== How It Works ===== */}
      <section className="py-24 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-indigo-600 font-semibold text-sm uppercase tracking-wider">How It Works</span>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 mt-3">Get Started in Minutes</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "01", icon: Settings, title: "Set Up Your Store", desc: "Use the interactive setup wizard to create your superadmin account and first store in minutes." },
              { step: "02", icon: Palette, title: "Customize & Add Products", desc: "Configure your brand, add products with variants, set up categories, offers, and discounts." },
              { step: "03", icon: Store, title: "Launch & Sell", desc: "Your storefront is live. Customers can browse, filter, cart, and checkout — all in their currency and language." },
            ].map((s, i) => (
              <div key={s.step} className="relative animate-slide-in-up" style={{ animationDelay: `${i * 0.15}s` }}>
                {i < 2 && (
                  <div className="hidden md:block absolute top-12 left-full w-full h-0.5 border-t-2 border-dashed border-slate-200" style={{ zIndex: 0 }} />
                )}
                <div className="relative bg-white rounded-3xl border border-slate-100 p-8 hover:shadow-xl transition">
                  <div className="text-6xl font-extrabold text-slate-100 absolute top-4 right-6">{s.step}</div>
                  <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center mb-5">
                    <s.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="relative text-xl font-bold text-slate-900 mb-2">{s.title}</h3>
                  <p className="relative text-slate-500">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Tech Stack ===== */}
      <section className="py-24 px-4 sm:px-6 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto text-center">
          <span className="text-indigo-400 font-semibold text-sm uppercase tracking-wider">Tech Stack</span>
          <h2 className="text-4xl sm:text-5xl font-extrabold mt-3 mb-16">Built With Modern Technology</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6">
            {[
              { name: "Go + Gin", desc: "Backend API" },
              { name: "Next.js", desc: "Storefront" },
              { name: "React + Vite", desc: "Backoffice" },
              { name: "PostgreSQL", desc: "Database" },
              { name: "Redis", desc: "Cache & Sessions" },
              { name: "Docker", desc: "Deployment" },
            ].map((t, i) => (
              <div
                key={t.name}
                className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10 hover:bg-white/10 hover:scale-105 transition-all animate-scale-in"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <p className="text-lg font-bold">{t.name}</p>
                <p className="text-sm text-white/50 mt-1">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Stats Banner ===== */}
      <section className="py-20 px-4 sm:px-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {[
            { value: "Unlimited", label: "Stores" },
            { value: "8+", label: "Toast Types" },
            { value: "4", label: "Role Levels" },
            { value: "100%", label: "Dockerized" },
          ].map((s, i) => (
            <div key={s.label} className="animate-slide-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <p className="text-5xl sm:text-6xl font-extrabold">{s.value}</p>
              <p className="text-lg text-white/70 mt-2">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Final CTA ===== */}
      <section className="py-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 rounded-3xl p-12 sm:p-16 overflow-hidden animate-gradient">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-float" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-300/20 rounded-full blur-3xl animate-float-delayed" />
            <div className="relative">
              <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4">
                Ready to Get Started?
              </h2>
              <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
                Explore the demo store or jump into the backoffice to see TruCommerce in action.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/demo"
                  className="group px-8 py-4 rounded-2xl bg-white text-indigo-700 font-bold text-lg hover:bg-indigo-50 transition shadow-2xl inline-flex items-center gap-2 hover:gap-3"
                >
                  Visit Demo Store
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <a
                  href="/backoffice"
                  className="px-8 py-4 rounded-2xl bg-white/15 backdrop-blur-md border border-white/30 text-white font-bold text-lg hover:bg-white/25 transition shadow-lg inline-flex items-center gap-2"
                >
                  <Settings className="w-5 h-5" />
                  Backoffice
                </a>
              </div>
              <p className="text-sm text-white/60 mt-8">
                Demo login: <code className="bg-black/20 px-2 py-1 rounded">admin@trucommerce.app</code> /{" "}
                <code className="bg-black/20 px-2 py-1 rounded">admin12345</code>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="bg-slate-900 text-white py-12 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-lg">
                TC
              </div>
              <span className="text-xl font-bold">TruCommerce</span>
            </div>
            <div className="flex gap-6 text-sm text-white/60">
              <Link href="/demo" className="hover:text-white transition">Store</Link>
              <a href="/backoffice" className="hover:text-white transition">Backoffice</a>
              <span>Go + React + PostgreSQL + Redis + Docker</span>
            </div>
          </div>
          <div className="border-t border-white/10 mt-8 pt-8 text-center text-sm text-white/40">
            &copy; {new Date().getFullYear()} TruCommerce. Ecommerce Platform.
          </div>
        </div>
      </footer>
    </main>
  );
}
