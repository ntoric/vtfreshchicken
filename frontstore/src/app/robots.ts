import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/backoffice/", "/account/", "/cart", "/checkout", "/orders", "/wishlist"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
