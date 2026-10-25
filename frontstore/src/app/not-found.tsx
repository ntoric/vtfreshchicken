import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page Not Found",
  robots: { index: false, follow: false },
};

export default function TenantNotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center py-20">
      <div className="mb-4">
        <span className="text-6xl font-bold" style={{ color: "var(--brand-color)" }}>
          404
        </span>
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">Page not found</h1>
      <p className="text-gray-500 max-w-sm mb-6">
        The page you're looking for doesn't exist or may have been moved.
      </p>
      <Link
        href="."
        className="text-white px-5 py-2 rounded-lg text-sm font-medium transition hover:opacity-90"
        style={{ backgroundColor: "var(--brand-color)" }}
      >
        Back to store
      </Link>
    </div>
  );
}
