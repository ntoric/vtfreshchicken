"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchReviews } from "@/lib/api";
import { InlineLoader } from "@/components/Loaders";
import type { Review } from "@/types";

function StarRow({ rating, size = "w-4 h-4" }: { rating: number; size?: string }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`${size} ${star <= rating ? "text-amber-400 fill-current" : "text-gray-200 fill-current"}`}
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="py-5 border-b last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand to-brand-dark text-white flex items-center justify-center font-semibold text-sm">
            {review.author_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-900 text-sm">{review.author_name}</p>
              {review.is_verified && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.404 12.652a8 8 0 1 0-12.808 0 8 8 0 0 0 12.808 0Zm-7.404-2.652a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm-1-3a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1Z" clipRule="evenodd" />
                  </svg>
                  Verified
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <StarRow rating={review.rating} />
              <span className="text-xs text-gray-400">{formatDate(review.created_at)}</span>
            </div>
          </div>
        </div>
      </div>
      {review.title && (
        <h4 className="font-semibold text-gray-900 mt-3">{review.title}</h4>
      )}
      <p className="text-gray-600 text-sm leading-relaxed mt-1">{review.body}</p>
      {review.images && review.images.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {review.images.map((img) => (
            <a
              key={img.id}
              href={img.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-16 h-16 rounded-lg overflow-hidden border border-gray-200 hover:opacity-80 transition"
            >
              <img src={img.url} alt={img.alt || "Review photo"} className="w-full h-full object-cover" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReviewsSection({ productId }: { productId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["reviews", productId],
    queryFn: () => fetchReviews(productId),
  });

  const reviews = data?.items ?? [];
  const summary = data?.summary;
  const total = summary?.total_reviews ?? 0;
  const avg = summary?.rating ?? 0;
  const dist = summary?.distribution ?? {};

  return (
    <div className="space-y-6">
      {/* Rating summary */}
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8 items-start">
        <div className="text-center md:text-left">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-gray-900">{avg.toFixed(1)}</span>
            <span className="text-gray-400 text-lg">/ 5</span>
          </div>
          <StarRow rating={Math.round(avg)} size="w-5 h-5" />
          <p className="text-sm text-gray-500 mt-2">{total} review{total !== 1 ? "s" : ""}</p>
        </div>
        {/* Distribution bars */}
        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = dist[star] ?? 0;
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-3">
                <span className="text-sm text-gray-500 w-12 flex items-center gap-1">
                  {star} <svg className="w-3.5 h-3.5 text-amber-400 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                </span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-sm text-gray-400 w-8 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reviews list */}
      {isLoading ? (
        <InlineLoader label="Loading reviews" />
      ) : reviews.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <p className="text-lg font-medium">No reviews yet</p>
          <p className="text-sm mt-1">Reviews are shared by verified customers after delivery</p>
        </div>
      ) : (
        <div className="divide-y">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}

      {/* Review submissions happen from delivered orders */}
      <p className="text-xs text-gray-400 border-t pt-4">
        Purchased this product? You can review it from your{" "}
        <Link href="/orders" className="text-brand hover:underline">delivered orders</Link>.
      </p>
    </div>
  );
}
