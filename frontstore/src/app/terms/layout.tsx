import type { Metadata } from "next";
import { fetchStorePage } from "@/lib/api";

const DEFAULT_TITLE = "Terms of Service";
const DEFAULT_DESCRIPTION =
  "The terms and conditions that govern orders and use of the VT Fresh Chicken store.";

export async function generateMetadata(): Promise<Metadata> {
  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESCRIPTION;
  try {
    const page = await fetchStorePage("terms");
    title = page.meta_title || page.title || title;
    description = page.meta_description || description;
  } catch {
    // fall back to defaults
  }

  return {
    title,
    description,
    alternates: { canonical: "/terms" },
    openGraph: { type: "website", title, description, url: "/terms" },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: true, follow: true },
  };
}

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
