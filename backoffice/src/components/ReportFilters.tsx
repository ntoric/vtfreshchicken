import { useState, useEffect, useCallback } from "react";
import { Calendar, Search, X } from "lucide-react";

/**
 * Shared filter bar for reports and tables.
 * Supports date range (from/to), preset ranges, optional selectors, and search.
 * Calls `onChange` whenever any filter value changes (debounced for search).
 */

export interface SelectOption {
  value: string;
  label: string;
}

export interface ReportFiltersValue {
  from?: string; // ISO date (yyyy-mm-dd)
  to?: string;   // ISO date (yyyy-mm-dd)
  search?: string;
  [key: string]: string | undefined; // arbitrary select fields
}

export interface ReportFiltersProps {
  value: ReportFiltersValue;
  onChange: (v: ReportFiltersValue) => void;
  // Optional select dropdowns (e.g. status, type, gateway)
  selects?: { key: string; label: string; options: SelectOption[]; placeholder?: string }[];
  // Show the search input
  search?: boolean;
  searchPlaceholder?: string;
  // Show the date range pickers + presets
  dateRange?: boolean;
}

const PRESETS: { label: string; days?: number | null; month?: boolean; year?: boolean }[] = [
  { label: "Today", days: 0 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "This month", month: true },
  { label: "This year", year: true },
  { label: "All time", days: null },
];

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfYear(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), 0, 1);
}

export function ReportFilters({
  value,
  onChange,
  selects = [],
  search = false,
  searchPlaceholder = "Search…",
  dateRange = true,
}: ReportFiltersProps) {
  const [searchInput, setSearchInput] = useState(value.search || "");

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== (value.search || "")) {
        onChange({ ...value, search: searchInput || undefined });
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const applyPreset = useCallback((preset: typeof PRESETS[number]) => {
    if (preset.days === null || preset.days === undefined) {
      if (!preset.month && !preset.year) {
        onChange({ ...value, from: undefined, to: undefined });
        return;
      }
    }
    if (preset.days !== null && preset.days !== undefined) {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const from = new Date();
      from.setDate(from.getDate() - preset.days);
      from.setHours(0, 0, 0, 0);
      onChange({ ...value, from: toISODate(from), to: toISODate(today) });
      return;
    }
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (preset.month) {
      onChange({ ...value, from: toISODate(startOfMonth()), to: toISODate(today) });
    } else if (preset.year) {
      onChange({ ...value, from: toISODate(startOfYear()), to: toISODate(today) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, onChange]);

  const hasFilters = (value.from || value.to || value.search ||
    selects.some((s) => value[s.key]));

  const clearAll = () => {
    setSearchInput("");
    const cleared: ReportFiltersValue = {};
    onChange(cleared);
  };

  return (
    <div className="bg-white rounded-2xl border p-4 mb-5 space-y-3">
      {/* Date presets */}
      {dateRange && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500 mr-1">Quick range:</span>
          {PRESETS.map((p) => {
            const active =
              p.days === null || p.days === undefined ? !value.from && !value.to :
              p.month ? value.from === toISODate(startOfMonth()) :
              p.year ? value.from === toISODate(startOfYear()) :
              false;
            return (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                  active ? "bg-brand text-white" : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-3">
        {dateRange && (
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={value.from || ""}
              onChange={(e) => onChange({ ...value, from: e.target.value || undefined })}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
            <span className="text-slate-400 text-sm">→</span>
            <input
              type="date"
              value={value.to || ""}
              onChange={(e) => onChange({ ...value, to: e.target.value || undefined })}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
          </div>
        )}

        {selects.map((sel) => (
          <select
            key={sel.key}
            value={value[sel.key] || ""}
            onChange={(e) => onChange({ ...value, [sel.key]: e.target.value || undefined })}
            className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
          >
            <option value="">{sel.placeholder || sel.label}</option>
            {sel.options.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ))}

        {search && (
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
          </div>
        )}

        {hasFilters && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600 transition ml-auto"
          >
            <X className="w-3.5 h-3.5" /> Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
