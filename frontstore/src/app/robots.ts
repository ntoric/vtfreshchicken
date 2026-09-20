import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/backoffice/", "/*/account/", "/*/cart", "/*/checkout", "/*/orders", "/*/wishlist"],
    },
    sitemap: "/sitemap.xml",
  };
}
