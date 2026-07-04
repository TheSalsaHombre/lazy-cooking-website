// Zero-dependency local web server for the built app.
// Run `npm start` (build + serve) or `npm run serve` (serve an existing build).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const DIR = "dist";
const PORT = 8000;
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml",
  ".png": "image/png", ".ico": "image/x-icon",
};

createServer(async (req, res) => {
  let p = decodeURIComponent((req.url || "/").split("?")[0]);
  if (p === "/") p = "/index.html";
  const safe = normalize(p).replace(/^(\.\.[/\\])+/, "");
  const file = join(DIR, safe);
  try {
    const buf = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(buf);
  } catch {
    try {
      const buf = await readFile(join(DIR, "index.html"));
      res.writeHead(200, { "content-type": "text/html" });
      res.end(buf);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  }
}).listen(PORT, () => {
  console.log(`\n  Lazy Cooking Website is running.`);
  console.log(`  Open this in your browser:  http://localhost:${PORT}\n`);
  console.log(`  Press Ctrl+C here to stop it.\n`);
});
