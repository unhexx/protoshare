import { Hono } from "hono";
import { listenHono, type ShareServer } from "./server.ts";

export type SidecarShareRequest = {
  origin: string;
  title?: string;
};

export type SidecarShareResponse = {
  url: string;
};

export function isLocalPreviewOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!ipv4) return false;
  const a = Number(ipv4[1]);
  const b = Number(ipv4[2]);
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export async function startSidecar(opts: {
  port: number;
  onShare: (req: SidecarShareRequest) => Promise<SidecarShareResponse>;
}): Promise<ShareServer> {
  const app = new Hono();

  app.use("*", async (c, next) => {
    c.header("Access-Control-Allow-Origin", "*");
    c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    c.header("Access-Control-Allow-Headers", "content-type");
    if (c.req.method === "OPTIONS") return c.body(null, 204);
    await next();
  });

  app.get("/health", (c) => c.json({ ok: true }));

  app.post("/v1/share", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid-json" }, 400);
    }
    if (!body || typeof body !== "object") {
      return c.json({ error: "invalid-json" }, 400);
    }
    const rec = body as Record<string, unknown>;
    if (typeof rec.origin !== "string" || rec.origin.trim().length === 0) {
      return c.json({ error: "missing-origin" }, 400);
    }
    const origin = rec.origin.trim();
    if (!isLocalPreviewOrigin(origin)) {
      return c.json({ error: "not-local" }, 400);
    }
    const title = typeof rec.title === "string" ? rec.title : undefined;
    try {
      const result = await opts.onShare({ origin, title });
      if (!result?.url) return c.json({ error: "share-failed" }, 500);
      return c.json({ url: result.url });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return c.json({ error: "share-failed", detail }, 500);
    }
  });

  return listenHono(app, opts.port);
}
