import type { Metadata } from "next";
import { fetchStorePage } from "@/lib/api";

const DEFAULT_TITLE = "Privacy Policy";
const DEFAULT_DESCRIPTION =
  "How VT Fresh Chicken collects, uses, and protects your personal data.";

export async function generateMetadata(): Promise<Metadata> {
  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESCRIPTION;
  try {
    const page = await fetchStorePage("privacy-policy");
    title = page.meta_title || page.title || title;
    description = page.meta_description || description;
  } catch {
    // fall back to defaults
  }

  return {
    title,
    description,
    alternates: { canonical: "/privacy-policy" },
    openGraph: { type: "website", title, description, url: "/privacy-policy" },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: true, follow: true },
  };
}

export default function PrivacyPolicyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
