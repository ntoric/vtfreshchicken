"use client";

import Link from "next/link";
import { useState, useEffect, useMemo, useRef } from "react";
import { LazyMotion, domAnimation, m, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
import { Menu, X, Search, ShoppingBag, Heart, User, ChevronDown, LogOut, Package, RotateCcw, LayoutDashboard, MapPin } from "lucide-react";
import type { BootstrapResponse } from "@/types";
import { BrandLogo } from "@/components/BrandLogo";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { useAuth } from "@/lib/auth";
import { useLocation } from "@/lib/location";

interface HeaderProps {
  bootstrap: BootstrapResponse;
  currency: string;
  setCurrency: (c: string) => void;
  lang: string;
  setLang: (l: string) => void;
  appearance?: "default" | "organic";
}

export function Header({ bootstrap, appearance = "default" }: HeaderProps) {
  const settings = bootstrap.settings;
  const brandColor = appearance === "organic" ? "#C9232C" : settings?.brand_color || "#C9232C";
  const logoUrl = settings?.logo_url;
  const storeName = bootstrap.store_name || "Store";
  const cart = useCart();
  const wishlist = useWishlist();
  const itemCount = cart?.itemCount ?? 0;
  const wishlistCount = wishlist?.itemCount ?? 0;
  const { customer, logout } = useAuth();
  const { area: deliveryArea, openPicker } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);

  // Nav overflow ("More" dropdown) — measure items, fold what doesn't fit
  const navItems = useMemo(
    () => [
      { label: "Home", href: `/` },
      ...(bootstrap.categories || []).map((c) => ({
        label: c.name,
        href: `/shop?category=${c.slug}`,
      })),
    ],
    [bootstrap.categories]
  );
  const navRef = useRef<HTMLElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = useState<number | null>(null);
  const shown = visibleCount ?? navItems.length;

  useEffect(() => {
    const nav = navRef.current;
    const measure = measureRef.current;
    if (!nav || !measure) return;

    const compute = () => {
      const itemEls = Array.from(measure.querySelectorAll<HTMLElement>("[data-nav-item]"));
      const widths = itemEls.map((el) => el.getBoundingClientRect().width);
      if (widths.length === 0) return;
      const gap = 4; // matches gap-1
      const total = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
      const avail = nav.clientWidth;
      if (total <= avail) {
        setVisibleCount(widths.length);
        return;
      }
      const moreEl = measure.querySelector<HTMLElement>("[data-nav-more]");
      const moreW = (moreEl?.getBoundingClientRect().width ?? 80) + gap;
      let used = 0;
      let count = 0;
      for (const w of widths) {
        if (used + w > avail - moreW) break;
        used += w + gap;
        count++;
      }
      setVisibleCount(Math.max(count, 1));
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(nav);
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [navItems.length]);

  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 20);
  });

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  // Close mobile menu on route change (hash/popstate)
  useEffect(() => {
    const close = () => setMobileMenuOpen(false);
    window.addEventListener("popstate", close);
    return () => window.removeEventListener("popstate", close);
  }, []);

  function handleLogout() {
    logout();
    setMenuOpen(false);
    setMobileMenuOpen(false);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    window.location.href = `/shop?search=${encodeURIComponent(searchQuery.trim())}`;
    setSearchOpen(false);
    setSearchQuery("");
  }

  return (
    <LazyMotion features={domAnimation} strict>
    <>
      {/* Announcement bar — scrolls away */}
      <div
        className="text-center text-xs font-medium py-2 px-4 text-white transition-all duration-300"
        style={{ backgroundColor: brandColor }}
      >
        {appearance === "organic" ? (
          <>
            <span className="hidden sm:inline">Fresh cuts. Thoughtful choices. Meals to look forward to.</span>
            <span className="sm:hidden">Good food starts with good chicken.</span>
          </>
        ) : (
          <>
            <span className="hidden sm:inline">✦ Free delivery on orders over ₹4,000 — Farm-fresh chicken, delivered chilled ✦</span>
            <span className="sm:hidden">✦ Free delivery over ₹4,000 ✦</span>
          </>
        )}
      </div>

      {/* Main navbar — sticky */}
      <header className="sticky top-0 z-40 pt-safe">
      <div
        className={`transition-all duration-300 ${
          scrolled
            ? "bg-white/90 backdrop-blur-xl backdrop-saturate-150 shadow-[0_2px_20px_-4px_rgba(0,0,0,0.1)]"
            : "bg-white/70 backdrop-blur-md backdrop-saturate-100"
        }`}
      >
        <div className={`max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 flex items-center gap-3 sm:gap-6 transition-all duration-300 ${scrolled ? "py-2.5" : "py-3.5"}`}>
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="xl:hidden p-2 -ml-2 rounded-xl hover:bg-stone-100 flex-shrink-0 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-gray-700" strokeWidth={1.8} />
          </button>

          {/* Logo */}
          <Link
            href={`/`}
            className="flex items-center gap-2.5 font-bold flex-shrink-0 min-w-0 group"
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={storeName}
                className="block max-h-10 w-auto max-w-[145px] sm:max-w-[190px] object-contain"
              />
            ) : (
              <BrandLogo storeName={storeName} className="w-[118px] min-[380px]:w-[145px] sm:w-[190px] overflow-hidden" />
            )}
          </Link>

          {/* Delivery location — opens area picker */}
          <button
            onClick={openPicker}
            className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 hover:bg-stone-100 hover:border-stone-300 px-3 py-2 text-xs font-medium text-gray-700 transition-colors flex-shrink-0"
            aria-label="Change delivery area"
          >
            <MapPin className="w-3.5 h-3.5 text-brand" strokeWidth={2} />
            <span className="max-w-[140px] truncate">
              {deliveryArea ? `Deliver to ${deliveryArea}` : "Select location"}
            </span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>

          {/* Desktop navigation — overflowing items fold into "More" */}
          <nav ref={navRef} className="hidden xl:flex items-center gap-1 text-sm font-medium ml-2 flex-1 min-w-0 relative">
            {/* invisible measurement row */}
            <div
              ref={measureRef}
              aria-hidden
              className="absolute top-0 left-0 h-0 overflow-visible invisible flex items-center gap-1 whitespace-nowrap"
            >
              {navItems.map((it) => (
                <span key={it.label} data-nav-item className="px-3 py-2">
                  {it.label}
                </span>
              ))}
              <span data-nav-more className="px-3 py-2 inline-flex items-center gap-1">
                More
                <ChevronDown className="w-3.5 h-3.5" />
              </span>
            </div>

            {navItems.slice(0, shown).map((it) => (
              <Link
                key={it.label}
                href={it.href}
                className="px-3 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-stone-100 whitespace-nowrap transition-all duration-200"
              >
                {it.label}
              </Link>
            ))}

            {shown < navItems.length && (
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setMoreOpen(!moreOpen)}
                  className="px-3 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-stone-100 whitespace-nowrap transition-all duration-200 inline-flex items-center gap-1"
                  aria-haspopup="menu"
                  aria-expanded={moreOpen}
                >
                  More
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${moreOpen ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {moreOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                      <m.div
                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.97 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-stone-200 py-2 z-50 overflow-hidden"
                      >
                        {navItems.slice(shown).map((it) => (
                          <Link
                            key={it.label}
                            href={it.href}
                            onClick={() => setMoreOpen(false)}
                            className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-stone-50 hover:text-gray-900 transition-colors"
                          >
                            {it.label}
                          </Link>
                        ))}
                      </m.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}
          </nav>

          {/* Search bar — desktop (fixed width) */}
          <div className="hidden xl:block w-64 flex-shrink-0 ml-auto">
            <form onSubmit={handleSearch} className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full pl-10 pr-4 py-2.5 rounded-full bg-stone-100 border border-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-stone-300 transition-all duration-200"
              />
            </form>
          </div>

          {/* Right-side controls */}
          <div className={`flex items-center gap-1 sm:gap-2 ${searchOpen ? "md:ml-auto" : ""}`}>
            {/* Search icon — mobile */}
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="xl:hidden p-2.5 rounded-xl hover:bg-stone-100 flex-shrink-0 transition-colors"
              aria-label="Search"
            >
              <Search className="w-5 h-5 text-gray-700" strokeWidth={1.8} />
            </button>

            {/* Language & currency selectors hidden — store runs English / INR only */}

            {/* Account — desktop */}
            {customer ? (
              <div className="relative hidden sm:block">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 p-2.5 rounded-xl hover:bg-stone-100 text-sm font-medium text-gray-700 transition-colors"
                >
                  <User className="w-5 h-5" strokeWidth={1.8} />
                  <span className="hidden lg:inline max-w-[80px] truncate">{customer.full_name?.split(" ")[0] || "Account"}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                      <m.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-stone-200 py-2 z-50 overflow-hidden"
                        onClick={() => setMenuOpen(false)}
                      >
                        <div className="px-4 py-3 border-b border-stone-100">
                          <p className="text-xs text-gray-400">Signed in as</p>
                          <p className="text-sm font-semibold text-gray-900 truncate">{customer.full_name || customer.email}</p>
                        </div>
                        <Link href={`/account/dashboard`} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-stone-50 transition-colors">
                          <LayoutDashboard className="w-4 h-4 text-gray-400" /> My Account
                        </Link>
                        <Link href={`/orders`} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-stone-50 transition-colors">
                          <Package className="w-4 h-4 text-gray-400" /> Order History
                        </Link>
                        {bootstrap.modules?.returns !== false && (
                        <Link href={`/orders/returns`} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-stone-50 transition-colors">
                          <RotateCcw className="w-4 h-4 text-gray-400" /> My Returns
                        </Link>
                        )}
                        <Link href={`/wishlist`} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-stone-50 transition-colors">
                          <Heart className="w-4 h-4 text-gray-400" /> Wishlist
                        </Link>
                        <hr className="my-1 border-stone-100" />
                        <button onClick={handleLogout} className="flex items-center gap-3 w-full text-left px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition-colors">
                          <LogOut className="w-4 h-4" /> Sign Out
                        </button>
                      </m.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <Link
                  href={`/account/login`}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-stone-100 transition-all"
                >
                  Sign In
                </Link>
                <Link
                  href={`/account/register`}
                  className="text-sm font-medium text-white px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all"
                  style={{ background: brandColor }}
                >
                  Register
                </Link>
              </div>
            )}

            {/* Wishlist */}
            <button
              onClick={() => wishlist?.openWishlist()}
              className="relative p-2.5 rounded-xl hover:bg-stone-100 flex-shrink-0 transition-colors group"
              aria-label="Wishlist"
            >
              <Heart className="w-5 h-5 text-gray-700 group-hover:text-rose-500 transition-colors" strokeWidth={1.8} />
              <AnimatePresence>
                {wishlistCount > 0 && (
                  <m.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-sm"
                  >
                    {wishlistCount}
                  </m.span>
                )}
              </AnimatePresence>
            </button>

            {/* Cart */}
            <button
              onClick={() => cart?.openCart()}
              className="relative p-2.5 rounded-xl hover:bg-stone-100 flex-shrink-0 transition-colors group"
              aria-label="Cart"
            >
              <ShoppingBag className="w-5 h-5 text-gray-700 group-hover:text-gray-900 transition-colors" strokeWidth={1.8} />
              <AnimatePresence>
                {itemCount > 0 && (
                  <m.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    className="absolute -top-0.5 -right-0.5 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-sm"
                    style={{ backgroundColor: brandColor }}
                  >
                    {itemCount}
                  </m.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>

        {/* Mobile search bar — expandable */}
        <AnimatePresence>
          {searchOpen && (
            <m.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="xl:hidden overflow-hidden border-t border-stone-200"
            >
              <form onSubmit={handleSearch} className="px-4 py-3">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="search"
                    autoFocus
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search products..."
                    className="w-full pl-10 pr-4 py-3 rounded-full bg-stone-100 border border-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-stone-300 transition-all"
                  />
                </div>
              </form>
            </m.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile category strip — shown on md and below */}
      <div className="xl:hidden bg-white/80 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2.5 flex gap-5 overflow-x-auto no-scrollbar text-sm font-medium text-gray-600">
          <Link href={`/`} className="whitespace-nowrap hover:text-gray-900 transition-colors">Home</Link>
          {(bootstrap.categories || []).map((cat) => (
            <Link key={cat.id} href={`/shop?category=${cat.slug}`} className="whitespace-nowrap hover:text-gray-900 transition-colors">
              {cat.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Mobile menu drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 xl:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <m.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 bottom-0 w-[85vw] max-w-sm bg-white z-50 shadow-2xl flex flex-col xl:hidden pt-safe pb-safe"
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between p-5 border-b border-stone-200">
                <Link
                  href={`/`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center"
                  style={{ color: brandColor }}
                >
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt={storeName}
                      className="block max-h-10 w-auto max-w-[145px] object-contain"
                    />
                  ) : (
                    <BrandLogo storeName={storeName} className="w-[145px]" />
                  )}
                </Link>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-xl hover:bg-stone-100 transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5 text-gray-700" strokeWidth={2} />
                </button>
              </div>

              {/* Drawer content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* Delivery location */}
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    openPicker();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 text-sm font-medium text-gray-700 hover:bg-stone-100 transition-colors"
                >
                  <MapPin className="w-4 h-4 text-brand shrink-0" strokeWidth={2} />
                  <span className="truncate">
                    {deliveryArea ? `Deliver to ${deliveryArea}` : "Select delivery location"}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-400 ml-auto shrink-0" />
                </button>

                {/* Navigation links */}
                <nav className="space-y-1">
                  <Link
                    href={`/`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-3 rounded-xl text-base font-medium text-gray-900 hover:bg-stone-100 transition-colors"
                  >
                    Home
                  </Link>
                  {(bootstrap.categories || []).map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/shop?category=${cat.slug}`}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-4 py-3 rounded-xl text-base font-medium text-gray-700 hover:bg-stone-100 transition-colors"
                    >
                      {cat.name}
                    </Link>
                  ))}
                </nav>

                {/* Account section */}
                <div className="pt-4 border-t border-stone-200">
                  {customer ? (
                    <div className="space-y-1">
                      <div className="px-4 py-3 text-sm text-gray-500">
                        Signed in as <span className="font-semibold text-gray-900">{customer.full_name || customer.email}</span>
                      </div>
                      <Link href={`/account/dashboard`} onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium text-gray-700 hover:bg-stone-100 transition-colors">
                        <LayoutDashboard className="w-5 h-5 text-gray-400" /> My Account
                      </Link>
                      <Link href={`/orders`} onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium text-gray-700 hover:bg-stone-100 transition-colors">
                        <Package className="w-5 h-5 text-gray-400" /> Order History
                      </Link>
                      {bootstrap.modules?.returns !== false && (
                      <Link href={`/orders/returns`} onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium text-gray-700 hover:bg-stone-100 transition-colors">
                        <RotateCcw className="w-5 h-5 text-gray-400" /> My Returns
                      </Link>
                      )}
                      <Link href={`/wishlist`} onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium text-gray-700 hover:bg-stone-100 transition-colors">
                        <Heart className="w-5 h-5 text-gray-400" /> Wishlist
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl text-base font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <LogOut className="w-5 h-5" /> Sign Out
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <Link
                        href={`/account/login`}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-stone-300 font-medium text-gray-700 hover:bg-stone-50 transition-colors"
                      >
                        <User className="w-4 h-4" /> Sign In
                      </Link>
                      <Link
                        href={`/account/register`}
                        onClick={() => setMobileMenuOpen(false)}
                        className="block w-full text-center py-3 rounded-xl text-white font-medium shadow-sm transition-all"
                        style={{ background: brandColor }}
                      >
                        Register
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </m.div>
          </>
        )}
      </AnimatePresence>
      </header>
    </>
    </LazyMotion>
  );
}
