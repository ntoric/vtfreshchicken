import type { Metadata } from "next";
import { LandingHome } from "@/components/LandingHome";

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

export default function Home() {
  return <LandingHome />;
}
