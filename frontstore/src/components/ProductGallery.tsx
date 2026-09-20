"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import type { ProductImage } from "@/types";

interface ProductGalleryProps {
  images: ProductImage[];
  fallbackUrl: string;
  alt: string;
}

export function ProductGallery({ images, fallbackUrl, alt }: ProductGalleryProps) {
  const allImages = images && images.length > 0 ? images : [{ id: "fallback", product_id: "", url: fallbackUrl, alt, sort_order: 0 }];
  const [activeIdx, setActiveIdx] = useState(0);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [isZooming, setIsZooming] = useState(false);
  const [tapZoomed, setTapZoomed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeImage = allImages[activeIdx];

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPos({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
  }, []);

  // Touch zoom: tap toggles zoom at tap location
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = ((touch.clientX - rect.left) / rect.width) * 100;
    const y = ((touch.clientY - rect.top) / rect.height) * 100;
    setZoomPos({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
  }, []);

  const handleTouchEnd = useCallback(() => {
    setTapZoomed((prev) => !prev);
  }, []);

  const showZoom = isZooming || tapZoomed;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Main image with hover/tap zoom */}
      <div
        ref={containerRef}
        className={`relative aspect-square bg-white rounded-2xl sm:rounded-3xl border overflow-hidden group ${
          showZoom ? "cursor-zoom-out" : "cursor-zoom-in"
        }`}
        onMouseEnter={() => setIsZooming(true)}
        onMouseLeave={() => setIsZooming(false)}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <Image
          src={activeImage.url}
          alt={activeImage.alt || alt}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover transition-transform duration-200"
          style={
            showZoom
              ? {
                  transform: `scale(2)`,
                  transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                }
              : undefined
          }
          priority
        />
        {/* Zoom hint badge — desktop hover only */}
        {!showZoom && (
          <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.3-4.3M11 8v6M8 11h6" />
            </svg>
            Hover to zoom
          </div>
        )}
        {/* Tap-to-zoom hint — mobile only */}
        {!showZoom && (
          <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 sm:hidden">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.3-4.3M11 8v6M8 11h6" />
            </svg>
            Tap to zoom
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {allImages.length > 1 && (
        <div className="flex gap-2 sm:gap-3 overflow-x-auto no-scrollbar">
          {allImages.map((img, i) => (
            <button
              key={img.id}
              onClick={() => { setActiveIdx(i); setTapZoomed(false); }}
              className={`relative flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 transition-all ${
                i === activeIdx
                  ? "border-brand ring-2 ring-brand/20"
                  : "border-gray-200 hover:border-gray-400"
              }`}
              aria-label={`View image ${i + 1}`}
            >
              <Image
                src={img.url}
                alt={img.alt || `${alt} ${i + 1}`}
                fill
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
