import { readFile } from "node:fs/promises";
import { join, normalize, sep } from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";

export type ShareServer = {
  origin: string;
  stop: () => Promise<void>;
};

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  png: "image/png",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  css: "text/css; charset=utf-8",
};

function safeJoin(root: string, urlPath: string): string | null {
  const relative = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const resolved = normalize(join(root, relative));
  const rootNorm = normalize(root).endsWith(sep)
    ? normalize(root)
    : normalize(root) + sep;
  if (resolved !== normalize(root) && !resolved.startsWith(rootNorm)) return null;
  return resolved;
}

export async function startShareServer(opts: {
  root: string;
  port: number;
}): Promise<ShareServer> {
  const app = new Hono();
  app.get("/*", async (c) => {
    const pathname = new URL(c.req.url).pathname;
    const file = safeJoin(opts.root, decodeURIComponent(pathname));
    if (!file) return c.text("forbidden", 403);
    try {
      const data = await readFile(file);
      const ext = file.split(".").pop() ?? "";
      return c.body(data, 200, {
        "content-type": TYPES[ext] ?? "application/octet-stream",
      });
    } catch {
      return c.text("not found", 404);
    }
  });

  const listening = await new Promise<ShareServer>((resolve, reject) => {
    const server = serve(
      { fetch: app.fetch, port: opts.port, hostname: "127.0.0.1" },
      (info) => {
        resolve({
          origin: `http://127.0.0.1:${info.port}`,
          stop: () =>
            new Promise((done, fail) => {
              server.close((err) => (err ? fail(err) : done()));
            }),
        });
      },
    );
    server.once("error", reject);
  });

  return listening;
}
