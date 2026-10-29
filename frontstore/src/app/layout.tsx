import type { Metadata, Viewport } from "next";
import { Poppins, Fraunces } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});
import { Providers } from "@/lib/providers";
import { fetchBootstrap } from "@/lib/api";
import { StorefrontShell } from "@/components/StorefrontShell";

const ICONS: Metadata["icons"] = {
  icon: [
    { url: "/icon.svg", type: "image/svg+xml" },
    { url: "/brand/favicon.ico", sizes: "any" },
  ],
  apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180" }],
};

export async function generateMetadata(): Promise<Metadata> {
  try {
    const bootstrap = await fetchBootstrap();
    const settings = bootstrap.settings;
    const storeName = bootstrap.store_name || "Store";
    const title = settings?.meta_title || storeName;
    const description = settings?.meta_description || `Shop at ${storeName}`;
    const ogImage = settings?.og_image || settings?.logo_url || undefined;
    const siteUrl = settings?.site_url || undefined;
    const baseUrl = siteUrl ? new URL(siteUrl) : undefined;

    return {
      title: {
        default: title,
        template: `%s | ${storeName}`,
      },
      description,
      icons: ICONS,
      metadataBase: baseUrl,
      alternates: {
        canonical: "/",
      },
      openGraph: {
        type: "website",
        siteName: storeName,
        title,
        description,
        url: "/",
        images: ogImage ? [{ url: ogImage }] : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: ogImage ? [ogImage] : undefined,
      },
      robots: {
        index: true,
        follow: true,
      },
    };
  } catch {
    return { icons: ICONS };
  }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#C9232C",
};

// Compute a darker shade for hover states (mix with 15% black)
function darken(hex: string) {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.round((n >> 16 & 0xff) * 0.85);
  const g = Math.round((n >> 8 & 0xff) * 0.85);
  const b = Math.round((n & 0xff) * 0.85);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let bootstrap;
  try {
    bootstrap = await fetchBootstrap();
  } catch (err) {
    console.error("[RootLayout] fetchBootstrap failed:", err);
    // notFound() is not allowed in the root layout — render a minimal fallback.
    return (
      <html lang="en">
        <body>
          <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
            <div style={{ textAlign: "center" }}>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Store unavailable</h1>
              <p style={{ marginTop: "0.5rem", color: "#666" }}>We couldn&apos;t reach the store backend. Please try again shortly.</p>
            </div>
          </div>
        </body>
      </html>
    );
  }

  const brand = bootstrap.settings?.brand_color || "#4f46e5";
  const brandDark = darken(brand);
  const storeName = bootstrap.store_name || "Store";
  const ogImage = bootstrap.settings?.og_image || bootstrap.settings?.logo_url || undefined;
  const siteUrl = bootstrap.settings?.site_url || undefined;

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: storeName,
    url: siteUrl || "/",
    ...(ogImage ? { logo: ogImage, image: ogImage } : {}),
    ...(bootstrap.settings?.social_links?.length ? { sameAs: bootstrap.settings.social_links } : {}),
  };

  return (
    <html lang="en">
      <body>
        <Providers>
          <div className={`${poppins.variable} ${fraunces.variable}`} style={{ ["--brand-color" as string]: brand, ["--brand-color-dark" as string]: brandDark, ["--brand-color-light" as string]: `${brand}1a` }}>
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
            />
            <StorefrontShell bootstrap={bootstrap}>
              {children}
            </StorefrontShell>
          </div>
        </Providers>
      </body>
    </html>
  );
}
