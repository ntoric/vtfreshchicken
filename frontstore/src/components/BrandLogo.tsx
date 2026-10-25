"use client";

interface BrandLogoProps {
  storeName?: string;
  inverse?: boolean;
  compact?: boolean;
  className?: string;
}

export function BrandLogo({
  storeName = "VT Fresh Chicken",
  inverse = false,
  compact = false,
  className = "",
}: BrandLogoProps) {
  const name = storeName || "VT Fresh Chicken";
  const isVt = name.trim().toLowerCase() === "vt fresh chicken";
  const primary = inverse ? "#FFFFFF" : "#171717";
  const secondary = inverse ? "#E3E3E0" : "#555555";

  return (
    <span
      role="img"
      aria-label={name}
      className={`inline-flex items-center gap-2.5 min-w-0 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={inverse ? "/brand/mark-reversed.svg" : "/brand/mark.svg"}
        alt=""
        aria-hidden
        className={`${compact ? "h-9 w-9" : "h-9 w-9 sm:h-11 sm:w-11"} shrink-0 rounded-full`}
      />
      {isVt ? (
        <span className="flex flex-col leading-none text-left min-w-0 overflow-hidden">
          <span
            className={`font-display tracking-tight whitespace-nowrap ${
              compact ? "text-[19px]" : "text-[19px] sm:text-[22px]"
            }`}
            style={{ color: primary }}
          >
            VT Fresh
          </span>
          <span
            className={`uppercase font-semibold whitespace-nowrap ${
              compact ? "text-[9.5px]" : "text-[9.5px] sm:text-[10.5px]"
            }`}
            style={{ color: secondary, letterSpacing: "0.42em", marginTop: 3 }}
          >
            Chicken
          </span>
        </span>
      ) : (
        <span
          className={`font-display tracking-tight truncate ${
            compact ? "text-[18px]" : "text-[18px] sm:text-[21px]"
          }`}
          style={{ color: primary }}
        >
          {name}
        </span>
      )}
    </span>
  );
}
