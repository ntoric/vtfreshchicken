"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import type { ProductImage } from "@/types";
import { thumbUrl } from "@/lib/images";

interface ProductGalleryProps {
  images: ProductImage[];
  fallbackUrl: string;
  alt: string;
}

/**
 * Product detail gallery. The main image is the full-resolution original
 * (desktop: hover to zoom); the strip below uses compressed thumbnails.
 * Clicking/tapping the main image opens a full-screen viewer that loads the
 * untouched original file.
 */
export function ProductGallery({ images, fallbackUrl, alt }: ProductGalleryProps) {
  const allImages = images && images.length > 0 ? images : [{ id: "fallback", product_id: "", url: fallbackUrl, alt, sort_order: 0 }];
  const [activeIdx, setActiveIdx] = useState(0);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [isZooming, setIsZooming] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeImage = allImages[activeIdx] ?? allImages[0];
  const count = allImages.length;

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPos({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
  }, []);

  // Indices whose main-size image is mounted (kept once mounted) / has finished loading.
  const [mounted, setMounted] = useState<Set<number>>(() => new Set([0]));
  const [loaded, setLoaded] = useState<Set<number>>(() => new Set());
  const mount = useCallback((i: number) => setMounted((s) => (s.has(i) ? s : new Set(s).add(i))), []);
  useEffect(() => mount(activeIdx), [activeIdx, mount]);

  const go = useCallback((delta: number) => setActiveIdx((i) => (i + delta + count) % count), [count]);

  if (!activeImage?.url) {
    return (
      <div className="relative aspect-square bg-gray-100 rounded-2xl sm:rounded-3xl border grid place-items-center text-sm text-gray-400">
        No image
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Main image: original, hover to zoom (desktop), click/tap for full-screen viewer */}
      <div
        ref={containerRef}
        role="button"
        tabIndex={0}
        aria-label="View full image"
        className="relative aspect-square bg-white rounded-2xl sm:rounded-3xl border overflow-hidden group cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        onMouseEnter={() => setIsZooming(true)}
        onMouseLeave={() => setIsZooming(false)}
        onMouseMove={handleMouseMove}
        onClick={() => setViewerOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setViewerOpen(true);
          }
        }}
      >
        {/* Every image that has been shown (or preloaded via thumbnail hover/touch)
            stays mounted, stacked; only the active one is visible. Swapping a single
            <Image>'s src left the previous picture on screen until the optimizer
            produced the new variant, so clicks looked ignored. */}
        {allImages.map((img, i) =>
          mounted.has(i) ? (
            <Image
              key={img.id ?? i}
              src={img.url}
              alt={img.alt || alt}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className={`object-cover transition-[transform,opacity] duration-200 ${
                i === activeIdx ? "opacity-100" : "opacity-0"
              }`}
              style={
                i === activeIdx && isZooming
                  ? {
                      transform: `scale(2)`,
                      transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                    }
                  : undefined
              }
              aria-hidden={i !== activeIdx}
              onLoad={() => setLoaded((s) => (s.has(i) ? s : new Set(s).add(i)))}
              priority={i === 0}
            />
          ) : null,
        )}
        {!loaded.has(activeIdx) && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-white/40">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" aria-label="Loading image" />
          </div>
        )}
        <div className="pointer-events-none absolute bottom-3 right-3 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <Maximize2 className="w-3.5 h-3.5" aria-hidden />
          <span className="hidden sm:inline">Hover to zoom · click to view</span>
          <span className="sm:hidden">Tap to view</span>
        </div>
      </div>

      {/* Thumbnail strip (compressed thumbnails) */}
      {count > 1 && (
        <div className="flex gap-2 sm:gap-3 overflow-x-auto no-scrollbar">
          {allImages.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => {
                mount(i);
                setActiveIdx(i);
              }}
              onMouseEnter={() => mount(i)}
              onFocus={() => mount(i)}
              onTouchStart={() => mount(i)}
              className={`relative flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 transition-all ${
                i === activeIdx ? "border-brand ring-2 ring-brand/20" : "border-gray-200 hover:border-gray-400"
              }`}
              aria-label={`Show image ${i + 1}`}
              aria-current={i === activeIdx}
            >
              <Image src={thumbUrl(img.url)} alt={img.alt || `${alt} ${i + 1}`} fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      {viewerOpen && (
        <ImageViewer
          images={allImages}
          index={activeIdx}
          alt={alt}
          onClose={() => setViewerOpen(false)}
          onPrev={() => go(-1)}
          onNext={() => go(1)}
        />
      )}
    </div>
  );
}

function ImageViewer({
  images,
  index,
  alt,
  onClose,
  onPrev,
  onNext,
}: {
  images: ProductImage[];
  index: number;
  alt: string;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const img = images[index];
  const multi = images.length > 1;
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (multi && e.key === "ArrowLeft") onPrev();
      else if (multi && e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [multi, onClose, onPrev, onNext]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${alt} — image ${index + 1} of ${images.length}`}
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
      onClick={onClose}
      onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        if (!multi || touchX.current == null) return;
        const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 50) (dx > 0 ? onPrev : onNext)();
      }}
    >
      {/* Plain <img>: the untouched original file, not an optimizer variant. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={img.url}
        src={img.url}
        alt={img.alt || alt}
        className="max-w-full max-h-full object-contain select-none"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />

      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-3 right-3 grid place-items-center w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <X className="w-5 h-5" />
      </button>

      {multi && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPrev();
            }}
            aria-label="Previous image"
            className="absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            aria-label="Next image"
            className="absolute right-3 top-1/2 -translate-y-1/2 grid place-items-center w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white tabular-nums">
            {index + 1} / {images.length}
          </p>
        </>
      )}
    </div>
  );
}
