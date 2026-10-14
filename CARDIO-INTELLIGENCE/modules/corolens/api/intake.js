// Vercel serverless function: POST {"note": "..."} -> structured record. The API key stays server-side.
import { extract } from "../web/intake_core.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST a JSON body {note}" });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const out = await extract(String(body.note || ""), { apiKey: process.env.TYPESAFE_API_KEY });
    res.status(200).json(out);
  } catch (e) {
    res.status(e.message.includes("not configured") ? 503 : 400).json({ error: e.message });
  }
}
