"use client";

import { useId } from "react";

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = "md",
  className = "",
}: ToggleProps) {
  const id = useId();
  const dims = size === "sm"
    ? { track: "w-9 h-5", knob: "w-3.5 h-3.5", translate: "translate-x-4" }
    : { track: "w-11 h-6", knob: "w-5 h-5", translate: "translate-x-5" };

  const toggle = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={label ? `${id}-label` : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex flex-shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
        dims.track
      } ${checked ? "bg-brand" : "bg-neutral-300"} ${className}`}
    >
      <span
        className={`inline-block ${dims.knob} transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
          checked ? dims.translate : "translate-x-0.5"
        }`}
      />
    </button>
  );

  if (!label && !description) {
    return toggle;
  }

  return (
    <div className={`flex items-start gap-3 ${disabled ? "opacity-60" : ""}`}>
      {toggle}
      {(label || description) && (
        <div className="flex-1 min-w-0">
          {label && (
            <label
              id={`${id}-label`}
              onClick={() => !disabled && onChange(!checked)}
              className={`block text-sm font-medium text-neutral-700 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
            >
              {label}
            </label>
          )}
          {description && (
            <p className="text-xs text-neutral-400 mt-0.5">{description}</p>
          )}
        </div>
      )}
    </div>
  );
}
