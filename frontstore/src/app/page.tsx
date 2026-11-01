import type { Metadata } from "next";
import { Suspense } from "react";
import { HomeVariant } from "@/components/landing/HomeVariant";
import { LandingSkeleton } from "@/components/landing/LandingSkeleton";

export const metadata: Metadata = {
  title: {
    absolute: "VT Fresh Chicken | Fresh & Frozen Chicken Delivered",
  },
  description:
    "VT Fresh Chicken — fresh cuts for today's cooking and frozen favourites for planning ahead, delivered to your door.",
  openGraph: {
    type: "website",
    title: "VT Fresh Chicken | Fresh & Frozen Chicken Delivered",
    description:
      "Fresh cuts for today's cooking and frozen favourites for planning ahead, delivered to your door.",
  },
  twitter: {
    card: "summary_large_image",
    title: "VT Fresh Chicken | Fresh & Frozen Chicken Delivered",
    description:
      "Fresh cuts for today's cooking and frozen favourites for planning ahead, delivered to your door.",
  },
};

// The homepage design is chosen server-side (Backoffice → Developer → Landing
// Page). The page itself never suspends: a lightweight skeleton streams
// immediately and the active design replaces it once resolved — and the
// route-wide spinner in app/loading.tsx is never shown for "/".
export default function Home() {
  return (
    <Suspense fallback={<LandingSkeleton />}>
      <HomeVariant />
    </Suspense>
  );
}
