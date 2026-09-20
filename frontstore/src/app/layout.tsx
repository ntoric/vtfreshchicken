import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/lib/providers";

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:13000"),
  title: {
    default: "TruCommerce",
    template: "%s | TruCommerce",
  },
  description: "Ecommerce storefront powered by TruCommerce",
  applicationName: "TruCommerce",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: "TruCommerce",
    title: "TruCommerce",
    description: "Ecommerce storefront powered by TruCommerce",
  },
  twitter: {
    card: "summary_large_image",
    title: "TruCommerce",
    description: "Ecommerce storefront powered by TruCommerce",
  },
  alternates: {
    canonical: "/",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#4f46e5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
