"use client";

import { useId } from "react";

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = "md",
  className = "",
}: CheckboxProps) {
  const id = useId();
  const dims = size === "sm"
    ? { box: "w-4 h-4 rounded", icon: "w-2.5 h-2.5" }
    : { box: "w-5 h-5 rounded-md", icon: "w-3 h-3" };

  const control = (
    <span className={`relative inline-flex flex-shrink-0 ${className}`}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`inline-flex items-center justify-center border transition-all duration-150 ease-out peer-active:scale-90 peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed ${
          dims.box
        } ${
          checked
            ? "border-brand bg-gradient-to-br from-brand to-brand-dark shadow-sm"
            : "border-slate-300 bg-white hover:border-brand hover:shadow-sm"
        }`}
      >
        <svg viewBox="0 0 12 10" fill="none" className={`${dims.icon} text-white`}>
          <path
            d="M1 5.2 4.3 8.5 11 1.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 15,
              strokeDashoffset: checked ? 0 : 15,
              transition: "stroke-dashoffset 180ms ease-out",
            }}
          />
        </svg>
      </span>
    </span>
  );

  if (!label && !description) {
    return control;
  }

  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-3 ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
    >
      {control}
      <span className="flex-1 min-w-0">
        {label && (
          <span className="block text-sm font-medium text-slate-700">{label}</span>
        )}
        {description && (
          <span className="block text-xs text-slate-400 mt-0.5">{description}</span>
        )}
      </span>
    </label>
  );
}
