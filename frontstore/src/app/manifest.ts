import type { MetadataRoute } from "next";
import { fetchBootstrap } from "@/lib/api";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let name = "Store";
  let description = "";
  let themeColor = "#C9232C";

  try {
    const bootstrap = await fetchBootstrap();
    name = bootstrap.store_name || name;
    description = bootstrap.settings?.meta_description || "";
    themeColor = bootstrap.settings?.brand_color || themeColor;
  } catch {
    // fall back to defaults
  }

  return {
    name,
    short_name: name,
    description,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: themeColor,
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/brand/favicon.ico", sizes: "any", type: "image/x-icon" },
      { src: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
