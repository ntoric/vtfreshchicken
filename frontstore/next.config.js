/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
    // AVIF is ~25-35% smaller than WebP at the same quality — matters on
    // bandwidth-constrained origins. Optimizer output is content-addressed,
    // so a long TTL is safe and avoids revalidation churn for repeat visitors.
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
    dangerouslyAllowSVG: true,
  },
  async rewrites() {
    const backend = process.env.INTERNAL_API_BASE_URL || "http://backend:8080";
    const backoffice = process.env.INTERNAL_BACKOFFICE_URL || "http://backoffice:5173";
    return [
      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
      // Proxy uploaded files to the backend static server
      {
        source: "/uploads/:path*",
        destination: `${backend}/uploads/:path*`,
      },
      // Proxy backoffice SPA to the Vite dev server (same domain, /backoffice prefix)
      {
        source: "/backoffice",
        destination: `${backoffice}/backoffice/`,
      },
      {
        source: "/backoffice/:path*",
        destination: `${backoffice}/backoffice/:path*`,
      },
    ];
  },
};
module.exports = nextConfig;
