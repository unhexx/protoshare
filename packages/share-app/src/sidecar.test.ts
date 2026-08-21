import { afterEach, describe, expect, it } from "vitest";
import { isLocalPreviewOrigin, startSidecar } from "./sidecar.ts";

describe("isLocalPreviewOrigin", () => {
  it("пускает loopback и частные сети", () => {
    expect(isLocalPreviewOrigin("http://127.0.0.1:6006")).toBe(true);
    expect(isLocalPreviewOrigin("http://localhost:5173")).toBe(true);
    expect(isLocalPreviewOrigin("http://192.168.0.10:3000")).toBe(true);
    expect(isLocalPreviewOrigin("http://10.1.2.3")).toBe(true);
  });

  it("режет публичные и кривые origin", () => {
    expect(isLocalPreviewOrigin("https://example.com")).toBe(false);
    expect(isLocalPreviewOrigin("ftp://127.0.0.1")).toBe(false);
    expect(isLocalPreviewOrigin("not a url")).toBe(false);
  });
});

describe("startSidecar", () => {
  let stop: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await stop?.();
    stop = undefined;
  });

  it("POST /v1/share отдаёт url и CORS", async () => {
    const server = await startSidecar({
      port: 0,
      onShare: async (req) => {
        expect(req.origin).toBe("http://127.0.0.1:6006");
        expect(req.title).toBe("Button");
        return { url: "http://127.0.0.1:4177/" };
      },
    });
    stop = server.stop;

    const preflight = await fetch(server.origin + "/v1/share", {
      method: "OPTIONS",
      headers: { origin: "http://127.0.0.1:6006" },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe("*");

    const res = await fetch(server.origin + "/v1/share", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ origin: "http://127.0.0.1:6006", title: "Button" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(await res.json()).toEqual({ url: "http://127.0.0.1:4177/" });
  });

  it("отклоняет чужой origin и битый JSON", async () => {
    const server = await startSidecar({
      port: 0,
      onShare: async () => ({ url: "http://127.0.0.1:4177/" }),
    });
    stop = server.stop;

    const remote = await fetch(server.origin + "/v1/share", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ origin: "https://evil.example" }),
    });
    expect(remote.status).toBe(400);
    expect(await remote.json()).toEqual({ error: "not-local" });

    const missing = await fetch(server.origin + "/v1/share", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(missing.status).toBe(400);
    expect(await missing.json()).toEqual({ error: "missing-origin" });
  });

  it("GET /health жив, ошибка handler — 500", async () => {
    const server = await startSidecar({
      port: 0,
      onShare: async () => {
        throw new Error("boom");
      },
    });
    stop = server.stop;

    const health = await fetch(server.origin + "/health");
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ ok: true });

    const res = await fetch(server.origin + "/v1/share", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ origin: "http://127.0.0.1:5173" }),
    });
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string; detail: string };
    expect(body.error).toBe("share-failed");
    expect(body.detail).toBe("boom");
  });
});
