// Local dev server: serves web/ and the /api/intake function (same code Vercel runs).
//   set -a; . ~/.config/typesafe/env; set +a; node server.mjs   ->  http://localhost:8787
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import handler from "./api/intake.js";

const WEB = new URL("./web/", import.meta.url).pathname;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png" };
const port = Number(process.env.PORT || 8787);

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/api/intake") {
    let body = "";
    for await (const c of req) body += c;
    const shim = {
      status(code) { res.statusCode = code; return shim; },
      json(obj) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(obj)); },
    };
    return handler({ method: req.method, body }, shim);
  }
  const path = normalize(join(WEB, url.pathname === "/" ? "index.html" : url.pathname));
  if (!path.startsWith(WEB)) return res.writeHead(403).end();
  try {
    const data = await readFile(path);
    res.writeHead(200, { "Content-Type": TYPES[extname(path)] || "application/octet-stream" }).end(data);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(port, () => console.log(`CoroLens on http://localhost:${port} (intake ${process.env.TYPESAFE_API_KEY ? "enabled" : "disabled: no TYPESAFE_API_KEY"})`));
