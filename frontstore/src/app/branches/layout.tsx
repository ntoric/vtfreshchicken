import type { Metadata } from "next";
import { fetchStorePage } from "@/lib/api";

const DEFAULT_TITLE = "Our Branches";
const DEFAULT_DESCRIPTION =
  "Find a VT Fresh Chicken branch near you — addresses, contact details, and the delivery areas each branch serves.";

export async function generateMetadata(): Promise<Metadata> {
  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESCRIPTION;
  try {
    const page = await fetchStorePage("branches");
    title = page.meta_title || page.title || title;
    description = page.meta_description || description;
  } catch {
    // fall back to defaults
  }

  return {
    title,
    description,
    alternates: { canonical: "/branches" },
    openGraph: { type: "website", title, description, url: "/branches" },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: true, follow: true },
  };
}

export default function BranchesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
