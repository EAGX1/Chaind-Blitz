// Zero-dependency static dev server for Chaind Blitz.
// Usage: node tools/serve.js [port]
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.argv[2]) || 8765;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8"
};

const server = http.createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (urlPath === "/") urlPath = "/index.html";
    const filePath = normalize(join(ROOT, urlPath));
    if (!filePath.startsWith(normalize(ROOT))) {
      res.writeHead(403); res.end("Forbidden"); return;
    }
    let target = filePath;
    const st = await stat(target).catch(() => null);
    if (!st) { res.writeHead(404); res.end("Not found: " + urlPath); return; }
    if (st.isDirectory()) target = join(target, "index.html");
    const body = await readFile(target);
    res.writeHead(200, {
      "Content-Type": MIME[extname(target).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(body);
  } catch (err) {
    res.writeHead(500); res.end(String(err));
  }
});

server.listen(PORT, () => {
  console.log(`Chaind Blitz dev server: http://localhost:${PORT}`);
});
