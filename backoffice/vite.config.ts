import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const backend = process.env.VITE_API_BASE_URL || "http://localhost:18080";

export default defineConfig({
  base: "/backoffice/",
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    hmr: false,
    proxy: {
      "/api": {
        target: backend,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: backend,
        changeOrigin: true,
      },
    },
  },
});
