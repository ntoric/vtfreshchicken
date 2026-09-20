import { createServer } from "http";
import { readFile, stat } from "fs/promises";
import { join, extname } from "path";

const PORT = 5173;
const DIST = join(process.cwd(), "dist");
const API_TARGET = process.env.VITE_API_BASE_URL || "http://backend:8080";

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json",
};

async function proxyToBackend(req, res) {
  // Forward API requests to the backend using Node's built-in http
  const { request } = await import("http");
  const url = new URL(req.url, API_TARGET);
  const proxyReq = request(
    {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: req.method,
      headers: { ...req.headers, host: url.host },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  proxyReq.on("error", (err) => {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("Bad Gateway: " + err.message);
  });
  req.pipe(proxyReq);
}

const server = createServer(async (req, res) => {
  const url = req.url || "/";

  // Proxy API requests to the backend
  if (url.startsWith("/api/")) {
    proxyToBackend(req, res);
    return;
  }

  // Strip /backoffice prefix for file serving
  let path = url;
  if (path.startsWith("/backoffice")) {
    path = path.slice("/backoffice".length) || "/";
  }
  if (path === "/" || path === "") path = "/index.html";

  let filePath = join(DIST, path);

  // Try the file
  try {
    const s = await stat(filePath);
    if (s.isFile()) {
      const data = await readFile(filePath);
      const mime = MIME[extname(filePath)] || "application/octet-stream";
      res.writeHead(200, {
        "Content-Type": mime,
        "Cache-Control": extname(filePath) === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
      });
      res.end(data);
      return;
    }
  } catch {
    // File not found, fall through to SPA fallback
  }

  // SPA fallback: serve index.html for any non-file route
  try {
    const data = await readFile(join(DIST, "index.html"));
    res.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-cache" });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Backoffice serving on http://0.0.0.0:${PORT}`);
});
