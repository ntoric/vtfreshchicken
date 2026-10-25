"use client";

import { useState } from "react";
import { Toggle } from "@/components/Toggle";
import type { Attribute } from "@/types";

interface FilterSidebarProps {
  attributes: Attribute[];
  selected: Record<string, string[]>;
  onChange: (attrs: Record<string, string[]>) => void;
  minPrice?: number;
  maxPrice?: number;
  onPriceChange: (min?: number, max?: number) => void;
}

export function FilterSidebar({
  attributes,
  selected,
  onChange,
  minPrice,
  maxPrice,
  onPriceChange,
}: FilterSidebarProps) {
  const [localMin, setLocalMin] = useState(minPrice?.toString() || "");
  const [localMax, setLocalMax] = useState(maxPrice?.toString() || "");

  const filterable = attributes.filter((a) => a.is_filterable);

  function toggle(slug: string, value: string) {
    const current = selected[slug] || [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    onChange({ ...selected, [slug]: next });
  }

  return (
    <aside className="space-y-6">
      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Price Range</h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Min"
            value={localMin}
            onChange={(e) => setLocalMin(e.target.value)}
            onBlur={() => onPriceChange(localMin ? Number(localMin) : undefined, localMax ? Number(localMax) : undefined)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <span className="text-gray-400">–</span>
          <input
            type="number"
            placeholder="Max"
            value={localMax}
            onChange={(e) => setLocalMax(e.target.value)}
            onBlur={() => onPriceChange(localMin ? Number(localMin) : undefined, localMax ? Number(localMax) : undefined)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      {filterable.map((attr) => (
        <div key={attr.id}>
          <h3 className="font-semibold text-gray-900 mb-3">{attr.name}</h3>
          <div className="space-y-2">
            {attr.options?.map((opt) => {
              const checked = (selected[attr.slug] || []).includes(opt.value);
              return (
                <label key={opt.id} className="flex items-center gap-2 text-sm cursor-pointer group">
                  <Toggle
                    size="sm"
                    checked={checked}
                    onChange={() => toggle(attr.slug, opt.value)}
                  />
                  {attr.type === "color" ? (
                    <span className="flex items-center gap-2">
                      <span
                        className="w-4 h-4 rounded-full border border-gray-200"
                        style={{ background: colorFor(opt.value) }}
                      />
                      {opt.label}
                    </span>
                  ) : (
                    <span className="group-hover:text-gray-900 text-gray-600">{opt.label}</span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      ))}

      {(Object.keys(selected).length > 0 || minPrice != null || maxPrice != null) && (
        <button
          onClick={() => {
            onChange({});
            setLocalMin("");
            setLocalMax("");
            onPriceChange(undefined, undefined);
          }}
          className="text-sm text-brand font-medium hover:underline"
        >
          Clear all filters
        </button>
      )}
    </aside>
  );
}

function colorFor(value: string): string {
  const map: Record<string, string> = {
    red: "#ef4444",
    blue: "#3b82f6",
    green: "#22c55e",
    black: "#111827",
    white: "#ffffff",
    navy: "#1e3a8a",
  };
  return map[value] || "#cbd5e1";
}
