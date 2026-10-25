import type { Metadata } from "next";

const title = "Cookie Policy";
const description =
  "How VT Fresh Chicken uses cookies and similar technologies, and how you can manage your preferences.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/cookie-policy" },
  openGraph: { type: "website", title, description, url: "/cookie-policy" },
  twitter: { card: "summary_large_image", title, description },
  robots: { index: true, follow: true },
};

export default function CookiePolicyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
