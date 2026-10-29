"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { X, Crop as CropIcon, ZoomIn, ZoomOut, RotateCw, Check, Upload } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { uploadImage } from "@/lib/api";
import { useToast } from "@/components/Toast";

export interface ImageCropModalProps {
  open: boolean;
  /** Image source: can be a File object or an existing URL */
  imageSrc: string | null;
  /** Original filename for the upload */
  filename?: string;
  /** Fixed aspect ratio (e.g., 1 for square, 4/3, 16/9). If undefined, free crop. */
  aspectRatio?: number;
  /** Maximum output width in pixels. The cropped image will be resized to fit. */
  maxWidth?: number;
  /** Maximum output height in pixels */
  maxHeight?: number;
  /** Called when the user confirms the crop. Receives the uploaded image URL. */
  onConfirm: (url: string) => void;
  /** Called when the user cancels */
  onCancel: () => void;
}

const ASPECT_PRESETS = [
  { label: "Free", value: undefined },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "16:9", value: 16 / 9 },
  { label: "3:4", value: 3 / 4 },
];

const SIZE_PRESETS = [
  { label: "Original", value: 0 },
  { label: "1200px", value: 1200 },
  { label: "800px", value: 800 },
  { label: "400px", value: 400 },
  { label: "200px", value: 200 },
];

export function ImageCropModal({
  open,
  imageSrc,
  filename,
  aspectRatio,
  maxWidth,
  maxHeight,
  onConfirm,
  onCancel,
}: ImageCropModalProps) {
  const { tenant } = useAuth();
  const toast = useToast();
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>(aspectRatio);
  const [maxSize, setMaxSize] = useState<number>(maxWidth || 0);
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [imgNaturalSize, setImgNaturalSize] = useState({ w: 0, h: 0 });

  // Reset state when modal opens with new image
  useEffect(() => {
    if (open && imageSrc) {
      setCrop(undefined);
      setCompletedCrop(undefined);
      setRotation(0);
      setScale(1);
      setAspect(aspectRatio);
      setMaxSize(maxWidth || 0);
    }
  }, [open, imageSrc, aspectRatio, maxWidth]);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    setImgNaturalSize({ w, h });
    // Auto-center crop on load
    if (aspectRatio) {
      setCrop(
        centerCrop(
          makeAspectCrop(
            { unit: "%", width: 90 },
            aspectRatio,
            w,
            h,
          ),
          w,
          h,
        ),
      );
    } else {
      setCrop({ unit: "%", width: 90, height: 90, x: 5, y: 5 });
    }
  }, [aspectRatio]);

  const getCroppedImg = useCallback(
    (image: HTMLImageElement, crop: PixelCrop, rot: number, scaleVal: number, outMaxSize: number): Promise<Blob> => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No 2D context");

      // Calculate the displayed image dimensions considering rotation
      const rotRad = (rot * Math.PI) / 180;
      const absCos = Math.abs(Math.cos(rotRad));
      const absSin = Math.abs(Math.sin(rotRad));

      // The image element's rendered size
      const renderedW = image.width;
      const renderedH = image.height;

      // Scale factor between natural and rendered
      const scaleX = image.naturalWidth / renderedW;
      const scaleY = image.naturalHeight / renderedH;

      // Crop in natural pixels
      const cropX = crop.x * scaleX;
      const cropY = crop.y * scaleY;
      const cropW = crop.width * scaleX;
      const cropH = crop.height * scaleY;

      // Output size
      let outputW = cropW;
      let outputH = cropH;

      if (outMaxSize > 0) {
        if (outputW > outputH) {
          if (outputW > outMaxSize) {
            outputH = (outputH * outMaxSize) / outputW;
            outputW = outMaxSize;
          }
        } else {
          if (outputH > outMaxSize) {
            outputW = (outputW * outMaxSize) / outputH;
            outputH = outMaxSize;
          }
        }
      }

      canvas.width = Math.round(outputW);
      canvas.height = Math.round(outputH);

      // Draw the cropped portion
      ctx.drawImage(
        image,
        cropX,
        cropY,
        cropW,
        cropH,
        0,
        0,
        outputW,
        outputH,
      );

      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Canvas is empty"));
              return;
            }
            resolve(blob);
          },
          "image/png",
          0.92,
        );
      });
    },
    [],
  );

  const handleConfirm = async () => {
    if (!imgRef.current || !completedCrop || !tenant) return;

    try {
      setUploading(true);
      const blob = await getCroppedImg(imgRef.current, completedCrop, rotation, scale, maxSize);
      const result = await uploadImage(blob, filename ? `cropped_${filename}` : undefined);
      toast.success("Image saved", "Cropped image has been uploaded.");
      onConfirm(result.url);
    } catch (e) {
      toast.error("Upload failed", (e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleSkipCrop = async () => {
    if (!imageSrc || !tenant) return;
    // If it's a File (data URL), upload directly; if it's a URL, just use it
    if (imageSrc.startsWith("data:")) {
      try {
        setUploading(true);
        const response = await fetch(imageSrc);
        const blob = await response.blob();
        const result = await uploadImage(blob, filename);
        onConfirm(result.url);
      } catch (e) {
        toast.error("Upload failed", (e as Error).message);
      } finally {
        setUploading(false);
      }
    } else {
      onConfirm(imageSrc);
    }
  };

  if (!open || !imageSrc) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <CropIcon className="w-5 h-5 text-brand" />
            <h2 className="font-semibold text-neutral-900">Crop & Resize Image</h2>
          </div>
          <button onClick={onCancel} className="text-neutral-400 hover:text-neutral-700 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Crop area */}
            <div className="flex-1 bg-neutral-100 rounded-xl p-4 flex items-center justify-center min-h-[300px] overflow-hidden">
              <div style={{ transform: `rotate(${rotation}deg) scale(${scale})`, transition: "transform 0.2s" }}>
                <ReactCrop
                  crop={crop}
                  onChange={(_, percentCrop) => setCrop(percentCrop)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={aspect}
                  keepSelection
                >
                  <img
                    ref={imgRef}
                    src={imageSrc}
                    alt="Crop preview"
                    onLoad={onImageLoad}
                    style={{ maxHeight: "400px", maxWidth: "100%" }}
                  />
                </ReactCrop>
              </div>
            </div>

            {/* Controls */}
            <div className="lg:w-64 space-y-5">
              {/* Aspect ratio */}
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-2">Aspect Ratio</label>
                <div className="flex flex-wrap gap-1.5">
                  {ASPECT_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => setAspect(p.value)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                        aspect === p.value
                          ? "bg-brand text-white border-transparent"
                          : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Output size */}
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-2">Max Output Size</label>
                <div className="flex flex-wrap gap-1.5">
                  {SIZE_PRESETS.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => setMaxSize(s.value)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                        maxSize === s.value
                          ? "bg-brand text-white border-transparent"
                          : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                {maxSize > 0 && (
                  <p className="text-[10px] text-neutral-400 mt-1">
                    Image will be resized so the longest side is {maxSize}px
                  </p>
                )}
              </div>

              {/* Rotation */}
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-2">
                  Rotation: {rotation}°
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setRotation((r) => (r - 90) % 360)}
                    className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition"
                  >
                    <RotateCw className="w-4 h-4 text-neutral-600 rotate-180" />
                  </button>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    value={rotation}
                    onChange={(e) => setRotation(Number(e.target.value))}
                    className="flex-1"
                  />
                  <button
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition"
                  >
                    <RotateCw className="w-4 h-4 text-neutral-600" />
                  </button>
                </div>
              </div>

              {/* Zoom */}
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-2">
                  Zoom: {scale.toFixed(2)}x
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
                    className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition"
                  >
                    <ZoomOut className="w-4 h-4 text-neutral-600" />
                  </button>
                  <input
                    type="range"
                    min={0.5}
                    max={3}
                    step={0.05}
                    value={scale}
                    onChange={(e) => setScale(Number(e.target.value))}
                    className="flex-1"
                  />
                  <button
                    onClick={() => setScale((s) => Math.min(3, s + 0.1))}
                    className="p-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition"
                  >
                    <ZoomIn className="w-4 h-4 text-neutral-600" />
                  </button>
                </div>
              </div>

              {/* Image info */}
              {imgNaturalSize.w > 0 && (
                <div className="text-xs text-neutral-400 bg-neutral-50 rounded-lg p-2">
                  <p>Original: {imgNaturalSize.w} × {imgNaturalSize.h}px</p>
                  {completedCrop && (
                    <p>
                      Crop: {Math.round(completedCrop.width * imgNaturalSize.w / 100)} × {Math.round(completedCrop.height * imgNaturalSize.h / 100)}px
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-neutral-50">
          <button
            onClick={handleSkipCrop}
            disabled={uploading}
            className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition disabled:opacity-50"
          >
            Skip Crop
          </button>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              disabled={uploading}
              className="px-4 py-2 text-sm font-medium text-neutral-600 border rounded-lg hover:bg-neutral-100 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={uploading || !completedCrop}
              className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-brand rounded-md hover:opacity-90 transition disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Save Cropped
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
