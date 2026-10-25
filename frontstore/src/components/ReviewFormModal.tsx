"use client";

import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Star, ImagePlus, Trash2, Loader2 } from "lucide-react";
import { createReview, uploadReviewImages, type UploadedImage } from "@/lib/api";
import type { PurchasedProduct } from "@/types";

interface ReviewFormModalProps {
  product: PurchasedProduct;
  brandColor: string;
  onClose: () => void;
  onSuccess: () => void;
}

const MAX_IMAGES = 5;

export function ReviewFormModal({ product, brandColor, onClose, onSuccess }: ReviewFormModalProps) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const submitMut = useMutation({
    mutationFn: () =>
      createReview(product.product_id, {
        rating,
        title,
        body,
        images: uploadedImages.map((img, i) => ({ url: img.url, alt: `Review photo ${i + 1}` })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchased-products"] });
      qc.invalidateQueries({ queryKey: ["my-reviews"] });
      qc.invalidateQueries({ queryKey: ["reviews", product.product_id] });
      onSuccess();
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const remaining = MAX_IMAGES - uploadedImages.length;
    const toUpload = files.slice(0, remaining);
    if (toUpload.length < files.length) {
      setUploadError(`You can upload up to ${MAX_IMAGES} images. Only ${toUpload.length} will be uploaded.`);
    } else {
      setUploadError("");
    }

    setUploading(true);
    try {
      const result = await uploadReviewImages(toUpload);
      setUploadedImages((prev) => [...prev, ...result.uploaded]);
      if (result.errors.length > 0) {
        setUploadError(result.errors.map((er) => `${er.filename}: ${er.error}`).join("; "));
      }
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = (idx: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const canSubmit = rating > 0 && !submitMut.isPending && !uploading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-3 min-w-0">
            {product.image_url && (
              <img src={product.image_url} alt={product.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
            )}
            <div className="min-w-0">
              <h2 className="font-bold text-slate-900 text-sm truncate">Write a Review</h2>
              <p className="text-xs text-slate-500 truncate">{product.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition flex-shrink-0">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {submitMut.isError && (
            <div className="bg-rose-50 text-rose-600 text-sm p-3 rounded-lg">
              Failed to submit review. {(submitMut.error as Error).message}
            </div>
          )}

          {/* Rating */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Your Rating *</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className="p-1"
                  aria-label={`Rate ${star} stars`}
                >
                  <Star
                    className={`w-7 h-7 transition ${(hoverRating || rating) >= star ? "text-amber-400 fill-current" : "text-slate-200 fill-current hover:text-amber-200"}`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Summarize your review"
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-slate-300"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Your Review *</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Tell us what you think about this product..."
              rows={4}
              className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-slate-300 resize-none"
            />
          </div>

          {/* Image upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Photos <span className="text-slate-400 font-normal">(optional, up to {MAX_IMAGES})</span>
            </label>
            <div className="flex flex-wrap gap-3">
              {uploadedImages.map((img, idx) => (
                <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border group">
                  <img src={img.url} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute top-0 right-0 bg-rose-500 text-white p-1 rounded-bl-lg opacity-0 group-hover:opacity-100 transition"
                    aria-label="Remove image"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {uploadedImages.length < MAX_IMAGES && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-slate-300 hover:text-slate-500 transition disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <ImagePlus className="w-5 h-5" />
                      <span className="text-[10px]">Add</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            {uploadError && <p className="text-xs text-rose-500 mt-1">{uploadError}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-5 border-t sticky bottom-0 bg-white rounded-b-2xl">
          <button
            onClick={() => submitMut.mutate()}
            disabled={!canSubmit}
            className="text-white font-medium px-5 py-2.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
            style={{ background: brandColor }}
          >
            {submitMut.isPending ? "Submitting…" : "Submit Review"}
          </button>
          <button
            onClick={onClose}
            className="text-slate-500 font-medium px-4 py-2.5 hover:text-slate-700 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
