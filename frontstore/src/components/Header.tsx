"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
import { Menu, X, Search, ShoppingBag, Heart, User, ChevronDown, Globe, LogOut, Package, RotateCcw, LayoutDashboard } from "lucide-react";
import type { BootstrapResponse } from "@/types";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { useAuth } from "@/lib/auth";

interface HeaderProps {
  tenant: string;
  bootstrap: BootstrapResponse;
  currency: string;
  setCurrency: (c: string) => void;
  lang: string;
  setLang: (l: string) => void;
}

export function Header({ tenant, bootstrap, currency, setCurrency, lang, setLang }: HeaderProps) {
  const settings = bootstrap.settings;
  const brandColor = settings?.brand_color || "#4f46e5";
  const cart = useCart();
  const wishlist = useWishlist();
  const itemCount = cart?.itemCount ?? 0;
  const wishlistCount = wishlist?.itemCount ?? 0;
  const { customer, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);

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
    window.location.href = `/${tenant}?view=shop&search=${encodeURIComponent(searchQuery.trim())}`;
    setSearchOpen(false);
    setSearchQuery("");
  }

  const languages = bootstrap.settings?.supported_languages?.length
    ? (bootstrap.languages || []).filter((l) => bootstrap.settings!.supported_languages!.includes(l.code))
    : (bootstrap.languages || []);

  return (
    <>
      {/* Announcement bar — scrolls away */}
      <div
        className="text-center text-xs font-medium py-2 px-4 text-white transition-all duration-300"
        style={{ backgroundColor: brandColor }}
      >
        <span className="hidden sm:inline">✦ Free shipping on orders over $50 — Shop the Autumn/Winter 2026 collection ✦</span>
        <span className="sm:hidden">✦ Free shipping over $50 ✦</span>
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
            className="lg:hidden p-2 -ml-2 rounded-xl hover:bg-stone-100 flex-shrink-0 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-gray-700" strokeWidth={1.8} />
          </button>

          {/* Logo */}
          <Link
            href={`/${tenant}`}
            className="flex items-center gap-2.5 font-bold flex-shrink-0 min-w-0 group"
          >
            <span
              className="inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex-shrink-0 transition-transform duration-300 group-hover:scale-105"
              style={{ background: brandColor }}
            >
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-white" strokeWidth={2} />
            </span>
            <span className="truncate text-lg sm:text-xl tracking-tight" style={{ color: brandColor }}>
              {bootstrap.store_name || "Store"}
            </span>
          </Link>

          {/* Desktop navigation */}
          <nav className="hidden lg:flex items-center gap-1 text-sm font-medium ml-2">
            <Link
              href={`/${tenant}`}
              className="px-3 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-stone-100 transition-all duration-200"
            >
              Home
            </Link>
            {(bootstrap.categories || []).slice(0, 6).map((cat) => (
              <Link
                key={cat.id}
                href={`/${tenant}?category=${cat.slug}`}
                className="px-3 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-stone-100 whitespace-nowrap transition-all duration-200"
              >
                {cat.name}
              </Link>
            ))}
          </nav>

          {/* Search bar — desktop */}
          <div className="hidden md:flex flex-1 max-w-xs ml-auto">
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
              className="md:hidden p-2.5 rounded-xl hover:bg-stone-100 flex-shrink-0 transition-colors"
              aria-label="Search"
            >
              <Search className="w-5 h-5 text-gray-700" strokeWidth={1.8} />
            </button>

            {/* Language & currency — desktop */}
            <div className="hidden sm:flex items-center gap-1.5">
              <div className="relative">
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  className="appearance-none text-sm bg-stone-100 rounded-lg pl-7 pr-7 py-2 text-gray-700 cursor-pointer hover:bg-stone-200 transition-colors focus:outline-none"
                  aria-label="Language"
                >
                  {languages.map((l) => (
                    <option key={l.code} value={l.code}>{l.name}</option>
                  ))}
                </select>
                <Globe className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="appearance-none text-sm bg-stone-100 rounded-lg px-2.5 py-2 pr-7 text-gray-700 cursor-pointer hover:bg-stone-200 transition-colors focus:outline-none relative"
                aria-label="Currency"
              >
                {(bootstrap.currencies || []).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} {c.symbol}
                  </option>
                ))}
              </select>
            </div>

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
                      <motion.div
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
                        <Link href={`/${tenant}/account/dashboard`} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-stone-50 transition-colors">
                          <LayoutDashboard className="w-4 h-4 text-gray-400" /> My Account
                        </Link>
                        <Link href={`/${tenant}/orders`} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-stone-50 transition-colors">
                          <Package className="w-4 h-4 text-gray-400" /> Order History
                        </Link>
                        <Link href={`/${tenant}/orders/returns`} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-stone-50 transition-colors">
                          <RotateCcw className="w-4 h-4 text-gray-400" /> My Returns
                        </Link>
                        <Link href={`/${tenant}/wishlist`} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-stone-50 transition-colors">
                          <Heart className="w-4 h-4 text-gray-400" /> Wishlist
                        </Link>
                        <hr className="my-1 border-stone-100" />
                        <button onClick={handleLogout} className="flex items-center gap-3 w-full text-left px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition-colors">
                          <LogOut className="w-4 h-4" /> Sign Out
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <Link
                  href={`/${tenant}/account/login`}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-stone-100 transition-all"
                >
                  Sign In
                </Link>
                <Link
                  href={`/${tenant}/account/register`}
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
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-sm"
                  >
                    {wishlistCount}
                  </motion.span>
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
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    className="absolute -top-0.5 -right-0.5 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-sm"
                    style={{ backgroundColor: brandColor }}
                  >
                    {itemCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>

        {/* Mobile search bar — expandable */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="md:hidden overflow-hidden border-t border-stone-200"
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile category strip — shown on md and below */}
      <div className="lg:hidden bg-white/80 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2.5 flex gap-5 overflow-x-auto no-scrollbar text-sm font-medium text-gray-600">
          <Link href={`/${tenant}`} className="whitespace-nowrap hover:text-gray-900 transition-colors">Home</Link>
          {(bootstrap.categories || []).map((cat) => (
            <Link key={cat.id} href={`/${tenant}?category=${cat.slug}`} className="whitespace-nowrap hover:text-gray-900 transition-colors">
              {cat.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Mobile menu drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 bottom-0 w-[85vw] max-w-sm bg-white z-50 shadow-2xl flex flex-col lg:hidden pt-safe pb-safe"
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between p-5 border-b border-stone-200">
                <Link
                  href={`/${tenant}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 font-bold text-lg"
                  style={{ color: brandColor }}
                >
                  <span
                    className="inline-flex items-center justify-center w-8 h-8 rounded-xl"
                    style={{ background: brandColor }}
                  >
                    <ShoppingBag className="w-4 h-4 text-white" strokeWidth={2} />
                  </span>
                  {bootstrap.store_name || "Store"}
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
                {/* Navigation links */}
                <nav className="space-y-1">
                  <Link
                    href={`/${tenant}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-3 rounded-xl text-base font-medium text-gray-900 hover:bg-stone-100 transition-colors"
                  >
                    Home
                  </Link>
                  {(bootstrap.categories || []).map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/${tenant}?category=${cat.slug}`}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-4 py-3 rounded-xl text-base font-medium text-gray-700 hover:bg-stone-100 transition-colors"
                    >
                      {cat.name}
                    </Link>
                  ))}
                </nav>

                {/* Language & currency selectors */}
                <div className="space-y-3 pt-4 border-t border-stone-200">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Language</label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <select
                        value={lang}
                        onChange={(e) => setLang(e.target.value)}
                        className="w-full text-sm border border-stone-200 rounded-xl pl-10 pr-3 py-3 bg-stone-50 focus:outline-none focus:border-gray-900 transition-colors"
                        aria-label="Language"
                      >
                        {languages.map((l) => (
                          <option key={l.code} value={l.code}>{l.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Currency</label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full text-sm border border-stone-200 rounded-xl px-3 py-3 bg-stone-50 focus:outline-none focus:border-gray-900 transition-colors"
                      aria-label="Currency"
                    >
                      {(bootstrap.currencies || []).map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} ({c.symbol})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Account section */}
                <div className="pt-4 border-t border-stone-200">
                  {customer ? (
                    <div className="space-y-1">
                      <div className="px-4 py-3 text-sm text-gray-500">
                        Signed in as <span className="font-semibold text-gray-900">{customer.full_name || customer.email}</span>
                      </div>
                      <Link href={`/${tenant}/account/dashboard`} onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium text-gray-700 hover:bg-stone-100 transition-colors">
                        <LayoutDashboard className="w-5 h-5 text-gray-400" /> My Account
                      </Link>
                      <Link href={`/${tenant}/orders`} onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium text-gray-700 hover:bg-stone-100 transition-colors">
                        <Package className="w-5 h-5 text-gray-400" /> Order History
                      </Link>
                      <Link href={`/${tenant}/orders/returns`} onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium text-gray-700 hover:bg-stone-100 transition-colors">
                        <RotateCcw className="w-5 h-5 text-gray-400" /> My Returns
                      </Link>
                      <Link href={`/${tenant}/wishlist`} onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium text-gray-700 hover:bg-stone-100 transition-colors">
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
                        href={`/${tenant}/account/login`}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-stone-300 font-medium text-gray-700 hover:bg-stone-50 transition-colors"
                      >
                        <User className="w-4 h-4" /> Sign In
                      </Link>
                      <Link
                        href={`/${tenant}/account/register`}
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
            </motion.div>
          </>
        )}
      </AnimatePresence>
      </header>
    </>
  );
}
