import type { Metadata } from "next";
import { fetchStorePage } from "@/lib/api";

const DEFAULT_TITLE = "Contact Us";
const DEFAULT_DESCRIPTION =
  "Get in touch with VT Fresh Chicken — questions about orders, delivery areas, or products.";

export async function generateMetadata(): Promise<Metadata> {
  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESCRIPTION;
  try {
    const page = await fetchStorePage("contact");
    title = page.meta_title || page.title || title;
    description = page.meta_description || description;
  } catch {
    // fall back to defaults
  }

  return {
    title,
    description,
    alternates: { canonical: "/contact" },
    openGraph: { type: "website", title, description, url: "/contact" },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: true, follow: true },
  };
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
