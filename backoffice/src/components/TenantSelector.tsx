import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { ChevronDown, Search, Building2, Check } from "lucide-react";

export function TenantSelector() {
  const { tenant, setTenant, user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const tenantsQ = useQuery({
    queryKey: ["tenants-list"],
    queryFn: () => api.listTenants(),
  });

  const tenants = tenantsQ.data?.items ?? [];
  const filtered = search
    ? tenants.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.slug.toLowerCase().includes(search.toLowerCase()),
      )
    : tenants;

  const activeTenant = tenants.find((t) => t.slug === tenant);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(slug: string) {
    setTenant(slug);
    setOpen(false);
    setSearch("");
    // Invalidate all queries so tenant-specific data is refetched
    qc.invalidateQueries();
  }

  if (tenantsQ.isLoading) {
    return (
      <div className="px-3 py-2 text-xs text-slate-400">Loading tenants…</div>
    );
  }

  if (tenantsQ.error || tenants.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-slate-400">
        No tenants available
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm hover:bg-slate-700 transition"
      >
        <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs text-slate-400">Active Store</p>
          <p className="font-medium truncate">
            {activeTenant?.name || tenant}
          </p>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-[100] min-w-[240px]">
          {/* Search */}
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search stores…"
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                autoFocus
              />
            </div>
          </div>

          {/* Tenant list */}
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-sm text-slate-400 text-center">
                No stores found
              </p>
            ) : (
              filtered.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleSelect(t.slug)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition ${
                    t.slug === tenant ? "bg-brand/5" : ""
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: "#4f46e5" }}
                  >
                    {t.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {t.name}
                    </p>
                    <p className="text-xs text-slate-400 truncate">/{t.slug}</p>
                  </div>
                  {t.slug === tenant && (
                    <Check className="w-4 h-4 text-brand flex-shrink-0" />
                  )}
                  {!t.is_active && (
                    <span className="text-[10px] text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                      Inactive
                    </span>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center">
              {tenants.length} store{tenants.length !== 1 ? "s" : ""} total
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
