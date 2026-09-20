import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchBootstrap } from "@/lib/api";
import { StorefrontShell } from "@/components/StorefrontShell";

export async function generateMetadata({
  params,
}: {
  params: { tenant: string };
}): Promise<Metadata> {
  try {
    const bootstrap = await fetchBootstrap(params.tenant);
    const settings = bootstrap.settings;
    const storeName = bootstrap.store_name || "TruCommerce";
    const title = settings?.meta_title || storeName;
    const description = settings?.meta_description || `Shop at ${storeName}`;
    const ogImage = settings?.og_image || settings?.logo_url || undefined;
    const siteUrl = settings?.site_url || undefined;
    const baseUrl = siteUrl ? new URL(siteUrl) : undefined;
    const tenantPath = `/${params.tenant}`;

    return {
      title: {
        default: title,
        template: `%s | ${storeName}`,
      },
      description,
      metadataBase: baseUrl,
      alternates: {
        canonical: tenantPath,
      },
      openGraph: {
        type: "website",
        siteName: storeName,
        title,
        description,
        url: tenantPath,
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
    return {};
  }
}

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { tenant: string };
}) {
  try {
    const bootstrap = await fetchBootstrap(params.tenant);
    const brand = bootstrap.settings?.brand_color || "#4f46e5";
    // Compute a darker shade for hover states (mix with 15% black)
    const darken = (hex: string) => {
      const m = hex.match(/^#?([0-9a-f]{6})$/i);
      if (!m) return hex;
      const n = parseInt(m[1], 16);
      const r = Math.round((n >> 16 & 0xff) * 0.85);
      const g = Math.round((n >> 8 & 0xff) * 0.85);
      const b = Math.round((n & 0xff) * 0.85);
      return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
    };
    const brandDark = darken(brand);
    const storeName = bootstrap.store_name || "TruCommerce";
    const ogImage = bootstrap.settings?.og_image || bootstrap.settings?.logo_url || undefined;
    const siteUrl = bootstrap.settings?.site_url || undefined;

    const orgJsonLd = {
      "@context": "https://schema.org",
      "@type": "Store",
      name: storeName,
      url: siteUrl || `/${params.tenant}`,
      ...(ogImage ? { logo: ogImage, image: ogImage } : {}),
      ...(bootstrap.settings?.social_links?.length ? { sameAs: bootstrap.settings.social_links } : {}),
    };

    return (
      <div style={{ ["--brand-color" as string]: brand, ["--brand-color-dark" as string]: brandDark, ["--brand-color-light" as string]: `${brand}1a` }}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <StorefrontShell tenant={params.tenant} bootstrap={bootstrap}>
          {children}
        </StorefrontShell>
      </div>
    );
  } catch (err) {
    console.error("[TenantLayout] fetchBootstrap failed:", err);
    notFound();
  }
}
