import type { MetadataRoute } from "next";
import { fetchBootstrap, fetchProducts } from "@/lib/api";

// Generates a sitemap for the storefront.
// Since this is a multitenant platform with path-based routing, we generate
// sitemap entries for the known demo tenant. In production with a tenant
// discovery endpoint, this would enumerate all active tenants.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // Landing page
  entries.push({
    url: "/",
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  });

  // Try to generate entries for known tenants
  const knownTenants = process.env.SITEMAP_TENANTS?.split(",").map((t) => t.trim()).filter(Boolean) || ["demo"];

  for (const tenant of knownTenants) {
    try {
      const bootstrap = await fetchBootstrap(tenant);
      const storeName = bootstrap.store_name || tenant;
      const baseUrl = `/${tenant}`;

      // Storefront home
      entries.push({
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 1.0,
      });

      // Category pages (via query params on storefront)
      if (bootstrap.categories) {
        for (const cat of bootstrap.categories) {
          if (cat.is_active) {
            entries.push({
              url: `${baseUrl}?category=${cat.slug}`,
              lastModified: new Date(),
              changeFrequency: "weekly",
              priority: 0.7,
            });
          }
        }
      }

      // Product pages
      const productsRes = await fetchProducts(tenant, { limit: 100, offset: 0 });
      if (productsRes.items) {
        for (const product of productsRes.items) {
          if (product.status === "active") {
            entries.push({
              url: `${baseUrl}/products/${product.slug}`,
              lastModified: new Date(product.updated_at || product.created_at),
              changeFrequency: "weekly",
              priority: 0.8,
            });
          }
        }
      }

      // Store pages (about, contact, privacy, terms, etc.)
      const staticPages = ["about", "contact", "privacy-policy", "terms", "cookie-policy"];
      for (const page of staticPages) {
        entries.push({
          url: `${baseUrl}/p/${page}`,
          lastModified: new Date(),
          changeFrequency: "monthly",
          priority: 0.4,
        });
      }
    } catch {
      // Skip tenants that fail to bootstrap
    }
  }

  return entries;
}
