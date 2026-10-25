import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Menu,
  ChevronDown,
  Globe,
  LogOut,
  User as UserIcon,
  Settings,
  Search,
  Bell,
  Building2,
  Check,
  Command,
} from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { api } from "@/lib/api";

export function TopNavbar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { user, tenant, tenantName, lang, setLang, logout } = useAuth();
  const { formatMoney } = useCurrency();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const [langOpen, setLangOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const brandName = tenantName || "Store";

  const langsQ = useQuery({
    queryKey: ["topnav-languages", tenant],
    queryFn: () => api.listLanguages(tenant),
    staleTime: 5 * 60 * 1000,
  });
  const languages = langsQ.data ?? [];
  const activeLang = languages.find((l) => l.code === lang);

  // Scroll detection
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Close dropdowns on route change
  useEffect(() => {
    setLangOpen(false);
    setProfileOpen(false);
    setNotifOpen(false);
  }, [location.pathname]);

  function handleLangChange(code: string) {
    setLang(code);
    setLangOpen(false);
    qc.invalidateQueries();
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    // Navigate to products with search query
    navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    setSearchQuery("");
  }

  // Derive page title from route
  const routeMap: Record<string, string> = {
    "/": "Dashboard",
    "/products": "Products",
    "/categories": "Categories",
    "/attributes": "Attributes",
    "/inventory": "Inventory",
    "/vendors": "Vendors",
    "/orders": "Orders",
    "/returns": "Returns",
    "/payments": "Payments",
    "/offers": "Offers",
    "/discounts": "Discounts",
    "/tax": "Tax",
    "/shipping": "Shipping",
    "/customers": "Customers",
    "/reports": "Reports",
    "/exports": "Exports",
    "/pages": "Page Builder",
    "/notifications": "Notifications",
    "/users": "Users & Staff",
    "/permissions": "Permissions",
    "/settings": "Settings",
  };
  const pageTitle = routeMap[location.pathname] || (location.pathname.includes("/products/") ? "Edit Product" : location.pathname.includes("/orders/") ? "Order Detail" : "Admin");

  return (
    <header
      className={`sticky top-0 z-30 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-xl shadow-[0_2px_20px_-4px_rgba(0,0,0,0.1)]"
          : "bg-white/80 backdrop-blur-lg"
      } border-b border-slate-200/80`}
    >
      <div className={`flex items-center justify-between px-4 lg:px-6 gap-3 transition-all duration-300 ${scrolled ? "py-2" : "py-3"}`}>
        {/* Left: mobile menu + brand + page title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onOpenSidebar}
            className="lg:hidden p-2 -ml-1 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" strokeWidth={1.8} />
          </button>

          {/* Brand */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <span className="w-8 h-8 rounded-xl bg-brand flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {brandName.charAt(0).toUpperCase() || "S"}
            </span>
            <div className="hidden sm:block">
              <span className="font-bold text-slate-900 text-sm tracking-tight">{brandName}</span>
              <span className="text-xs font-normal text-slate-400 ml-1.5">Backoffice</span>
            </div>
          </div>

          {/* Page title breadcrumb */}
          <div className="hidden md:flex items-center gap-2 ml-2 pl-4 border-l border-slate-200">
            <span className="text-sm font-medium text-slate-400">/</span>
            <span className="text-sm font-semibold text-slate-700">{pageTitle}</span>
          </div>
        </div>

        {/* Center: search bar */}
        <div className="hidden md:flex flex-1 max-w-md mx-auto">
          <form onSubmit={handleSearch} className="relative w-full group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-600 transition-colors" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, orders, customers..."
              className="w-full pl-10 pr-16 py-2.5 rounded-xl bg-slate-100 border border-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-brand/10 transition-all duration-200"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-medium text-slate-400">
              <Command className="w-3 h-3" />K
            </kbd>
          </form>
        </div>

        {/* Right: notifications, language, profile */}
        <div className="flex items-center gap-1.5 sm:gap-2">

          {/* Mobile search button */}
          <button
            onClick={() => {
              const input = document.querySelector('input[type="search"]') as HTMLInputElement;
              if (input) input.focus();
              else navigate("/products");
            }}
            className="md:hidden p-2.5 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
            aria-label="Search"
          >
            <Search className="w-5 h-5" strokeWidth={1.8} />
          </button>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className="relative p-2.5 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors group"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5 group-hover:text-slate-900 transition-colors" strokeWidth={1.8} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <span className="font-semibold text-sm text-slate-900">Notifications</span>
                  <Link to="/notifications" onClick={() => setNotifOpen(false)} className="text-xs text-brand hover:underline">
                    View all
                  </Link>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {[
                    { title: "New order received", desc: `Order #1024 — ${formatMoney(249)}`, time: "2 min ago", color: "bg-emerald-500" },
                    { title: "Low stock alert", desc: "3 products below threshold", time: "1 hour ago", color: "bg-amber-500" },
                    { title: "New customer registered", desc: "sarah@example.com", time: "3 hours ago", color: "bg-blue-500" },
                    { title: "Return request", desc: "Order #1018 — Size exchange", time: "5 hours ago", color: "bg-rose-500" },
                  ].map((n, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-50 last:border-0">
                      <span className={`w-2 h-2 rounded-full ${n.color} mt-1.5 flex-shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{n.title}</p>
                        <p className="text-xs text-slate-500 truncate">{n.desc}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{n.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Link
                  to="/notifications"
                  onClick={() => setNotifOpen(false)}
                  className="block text-center py-2.5 text-xs font-medium text-brand hover:bg-slate-50 transition-colors border-t border-slate-100"
                >
                  View all notifications
                </Link>
              </div>
            )}
          </div>

          {/* Language selector */}
          <div className="relative" ref={langRef}>
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="inline-flex items-center gap-1.5 px-2.5 py-2.5 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Language"
            >
              <Globe className="w-4 h-4 text-slate-400" strokeWidth={1.8} />
              <span className="hidden sm:inline text-xs font-medium">{activeLang?.code?.toUpperCase() || lang.toUpperCase()}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${langOpen ? "rotate-180" : ""}`} />
            </button>
            {langOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 overflow-hidden">
                {languages.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-400">No languages available</p>
                ) : (
                  languages.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => handleLangChange(l.code)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-slate-50 transition-colors ${
                        l.code === lang ? "text-brand font-medium bg-brand/5" : "text-slate-700"
                      }`}
                    >
                      <span>{l.name}</span>
                      <span className="text-xs text-slate-400 flex items-center gap-1.5">
                        {l.code.toUpperCase()}
                        {l.code === lang && <Check className="w-3.5 h-3.5 text-brand" />}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Profile dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="inline-flex items-center gap-2 p-1 pr-2 rounded-xl hover:bg-slate-100 transition-colors"
              aria-label="Profile"
            >
              <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {user?.full_name?.charAt(0).toUpperCase() || "U"}
              </div>
              <span className="hidden lg:inline text-sm font-medium text-slate-700 max-w-[100px] truncate">
                {user?.full_name}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`} />
            </button>
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                {/* User info header */}
                <div className="px-4 py-3.5 bg-slate-50 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {user?.full_name?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{user?.full_name}</p>
                      <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-brand/10 text-brand text-[10px] font-semibold uppercase tracking-wider">
                    {user?.role.replace("_", " ")}
                  </span>
                </div>

                {/* Quick links */}
                <div className="py-1.5">
                  <Link
                    to="/settings"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-slate-400" strokeWidth={1.8} />
                    Settings
                  </Link>
                  <Link
                    to="/users"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <UserIcon className="w-4 h-4 text-slate-400" strokeWidth={1.8} />
                    My Profile
                  </Link>
                </div>

                {/* Logout */}
                <div className="border-t border-slate-100 pt-1.5 pb-1.5">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" strokeWidth={1.8} />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile search bar */}
      <div className="md:hidden px-4 pb-3">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-100 border border-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-300 transition-all"
          />
        </form>
      </div>
    </header>
  );
}
