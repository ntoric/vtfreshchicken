import type { MetadataRoute } from "next";
import { fetchBootstrap, fetchProducts } from "@/lib/api";
import { getSiteUrl } from "@/lib/seo";

const PRODUCT_PAGE_SIZE = 200;
const MAX_PRODUCTS = 5000;

// Generates a sitemap for the store.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await getSiteUrl();
  const entries: MetadataRoute.Sitemap = [];

  // Landing page
  entries.push({
    url: `${base}/`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.9,
  });

  try {
    const bootstrap = await fetchBootstrap();

    // Storefront / shop
    entries.push({
      url: `${base}/shop`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    });

    // Category pages (via query params on the shop page)
    if (bootstrap.categories) {
      for (const cat of bootstrap.categories) {
        if (cat.is_active) {
          entries.push({
            url: `${base}/shop?category=${cat.slug}`,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 0.7,
          });
        }
      }
    }

    // Product pages (paginated)
    let offset = 0;
    let total = Infinity;
    while (offset < total && offset < MAX_PRODUCTS) {
      const res = await fetchProducts({ limit: PRODUCT_PAGE_SIZE, offset });
      total = res.total ?? 0;
      for (const product of res.items ?? []) {
        if (product.status === "active") {
          entries.push({
            url: `${base}/products/${product.slug}`,
            lastModified: new Date(product.updated_at || product.created_at),
            changeFrequency: "weekly",
            priority: 0.8,
          });
        }
      }
      offset += PRODUCT_PAGE_SIZE;
      if (!res.items || res.items.length === 0) break;
    }

    // Static pages (top-level routes backed by the page builder)
    const staticPages: Array<{ path: string; priority: number }> = [
      { path: "/about", priority: 0.5 },
      { path: "/contact", priority: 0.5 },
      { path: "/privacy-policy", priority: 0.3 },
      { path: "/terms", priority: 0.3 },
      { path: "/cookie-policy", priority: 0.3 },
    ];
    for (const page of staticPages) {
      entries.push({
        url: `${base}${page.path}`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: page.priority,
      });
    }
  } catch {
    // Skip store entries if bootstrap fails — still return the landing URL
  }

  return entries;
}
