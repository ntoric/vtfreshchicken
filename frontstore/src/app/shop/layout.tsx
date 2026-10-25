import type { Metadata } from "next";
import { fetchBootstrap } from "@/lib/api";

export async function generateMetadata(): Promise<Metadata> {
  let storeName = "Store";
  try {
    const bootstrap = await fetchBootstrap();
    storeName = bootstrap.store_name || storeName;
  } catch {
    // fall back to defaults
  }

  const title = "Shop";
  const description = `Browse the full ${storeName} catalogue — fresh and frozen chicken, cuts, combos and more, delivered to your door.`;

  return {
    title,
    description,
    alternates: { canonical: "/shop" },
    openGraph: { type: "website", title, description, url: "/shop" },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: true, follow: true },
  };
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children;
}
