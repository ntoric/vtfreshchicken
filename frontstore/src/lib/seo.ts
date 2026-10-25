import { fetchBootstrap } from "@/lib/api";

const FALLBACK_SITE_URL = "http://localhost:13000";

/**
 * Resolve the store's canonical site URL for SEO output (sitemap, robots,
 * canonical links, OG URLs). Server-side only.
 *
 * Priority:
 *  1. NEXT_PUBLIC_SITE_URL env var (deployment override)
 *  2. settings.site_url from the store bootstrap (admin-configured)
 *  3. Local dev fallback
 */
export async function getSiteUrl(): Promise<string> {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl) return envUrl.replace(/\/+$/, "");

  try {
    const bootstrap = await fetchBootstrap();
    const siteUrl = bootstrap.settings?.site_url;
    if (siteUrl) return siteUrl.replace(/\/+$/, "");
  } catch {
    // fall through to default
  }

  return FALLBACK_SITE_URL;
}
