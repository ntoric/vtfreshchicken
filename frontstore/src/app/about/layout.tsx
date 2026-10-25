import type { Metadata } from "next";
import { fetchStorePage } from "@/lib/api";

const DEFAULT_TITLE = "About Us";
const DEFAULT_DESCRIPTION =
  "Learn about VT Fresh Chicken — who we are, how we source our chicken, and why freshness matters.";

export async function generateMetadata(): Promise<Metadata> {
  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESCRIPTION;
  try {
    const page = await fetchStorePage("about");
    title = page.meta_title || page.title || title;
    description = page.meta_description || description;
  } catch {
    // fall back to defaults
  }

  return {
    title,
    description,
    alternates: { canonical: "/about" },
    openGraph: { type: "website", title, description, url: "/about" },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: true, follow: true },
  };
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
