import { Hono } from "hono";
import { serve } from "@hono/node-server";

const LT_URL = process.env.LT_URL || "http://127.0.0.1:5001";
const PORT = parseInt(process.env.PORT || "5000", 10);
const ALLOWED_ORIGINS = ["chrome-extension://", "moz-extension://"];

const app = new Hono();

app.use("*", async (c, next) => {
  const origin = c.req.header("Origin") || "";
  if (ALLOWED_ORIGINS.some((o) => origin.startsWith(o))) {
    c.header("Access-Control-Allow-Origin", origin);
  }
  c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type");

  if (c.req.method === "OPTIONS") {
    return c.body(null, 204);
  }
  await next();
});

app.get("/health", async (c) => {
  try {
    const res = await fetch(`${LT_URL}/languages`);
    if (!res.ok) throw new Error(`LT unavailable (${res.status})`);
    const languages = await res.json();
    const installed_pairs = languages
      .filter((l) => l.code !== "en")
      .map((l) => ({ from: l.code, to: "en" }));
    return c.json({ status: "ok", installed_pairs });
  } catch (e) {
    return c.json({ status: "error", error: e.message }, 503);
  }
});

app.post("/translate", async (c) => {
  let data;
  try {
    data = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const { texts, from, to } = data;

  if (!texts) return c.json({ error: "Missing 'texts' field" }, 400);
  if (!Array.isArray(texts)) return c.json({ error: "'texts' must be an array" }, 400);
  if (texts.length > 500) return c.json({ error: "Too many strings per request (max 500)" }, 400);

  const source = from || "pt";
  const target = to || "en";

  const translations = await Promise.all(
    texts.map(async (text) => {
      if (!text || !text.trim()) return text;
      try {
        const res = await fetch(`${LT_URL}/translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: text, source, target, format: "text" }),
        });
        if (!res.ok) throw new Error(`LT error ${res.status}`);
        const result = await res.json();
        return result.translatedText ?? text;
      } catch (e) {
        console.error("Translation error:", e.message);
        return text;
      }
    })
  );

  return c.json({ translations });
});

app.get("/languages", async (c) => {
  try {
    const res = await fetch(`${LT_URL}/languages`);
    return c.json(await res.json());
  } catch {
    return c.json({ error: "LibreTranslate unavailable" }, 503);
  }
});

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Proxy running on http://127.0.0.1:${info.port} → LT at ${LT_URL}`);
});
