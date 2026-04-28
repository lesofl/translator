import { Hono } from "hono";

const LT_URL = process.env.LT_URL || "http://127.0.0.1:5001";
const PORT = parseInt(process.env.PORT || "5000", 10);
const ALLOWED_ORIGINS = ["chrome-extension://", "moz-extension://"];

const app = new Hono();

app.use("*", async (c, next) => {
  c.header("Access-Control-Allow-Origin", "*");
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
    const languages = (await res.json()) as { code: string; name: string }[];
    const installed_pairs = languages
      .filter((l) => l.code !== "en")
      .map((l) => ({ from: l.code, to: "en" }));
    return c.json({ status: "ok", installed_pairs });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ status: "error", error: msg }, 503);
  }
});

app.post("/translate", async (c) => {
  let data: { texts?: unknown[]; from?: string; to?: string };
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
      const s = String(text);
      if (!s.trim()) return s;
      try {
        const res = await fetch(`${LT_URL}/translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: s, source, target, format: "text" }),
        });
        if (!res.ok) throw new Error(`LT error ${res.status}`);
        const result = (await res.json()) as { translatedText?: string };
        return result.translatedText ?? s;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("Translation error:", msg);
        return s;
      }
    }),
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

export default {
  port: PORT,
  fetch: app.fetch,
};

console.log(`Proxy starting on port ${PORT} → LT at ${LT_URL}`);
