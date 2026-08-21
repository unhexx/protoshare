import { afterEach, describe, expect, it } from "vitest";
import {
  isLocalPreviewOrigin,
  isLoopbackOrigin,
  startSidecar,
} from "./sidecar.ts";

describe("isLoopbackOrigin", () => {
  it("пускает localhost, 127.0.0.1 и ::1 на любом порту", () => {
    expect(isLoopbackOrigin("http://127.0.0.1:6006")).toBe(true);
    expect(isLoopbackOrigin("http://localhost:5173")).toBe(true);
    expect(isLoopbackOrigin("https://localhost")).toBe(true);
    expect(isLoopbackOrigin("http://[::1]:3000")).toBe(true);
  });

  it("режет RFC1918, публичные и кривые origin", () => {
    expect(isLoopbackOrigin("http://192.168.0.10:6006")).toBe(false);
    expect(isLoopbackOrigin("https://evil.example")).toBe(false);
    expect(isLoopbackOrigin("ftp://127.0.0.1")).toBe(false);
    expect(isLoopbackOrigin("not a url")).toBe(false);
  });
});

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

  it("POST /v1/share отдаёт url и эхо loopback Origin", async () => {
    const server = await startSidecar({
      port: 0,
      onShare: async (req) => {
        expect(req.origin).toBe("http://127.0.0.1:6006");
        expect(req.title).toBe("Button");
        return { url: "http://127.0.0.1:4177/" };
      },
    });
    stop = server.stop;

    const loopback = "http://127.0.0.1:6006";
    const preflight = await fetch(server.origin + "/v1/share", {
      method: "OPTIONS",
      headers: { origin: loopback },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe(loopback);
    expect(preflight.headers.get("access-control-allow-methods")).toContain("POST");
    expect(preflight.headers.get("access-control-allow-headers")).toContain(
      "content-type",
    );
    expect(preflight.headers.get("access-control-allow-credentials")).toBeNull();

    const res = await fetch(server.origin + "/v1/share", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: loopback,
      },
      body: JSON.stringify({ origin: loopback, title: "Button" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(loopback);
    expect(res.headers.get("access-control-allow-credentials")).toBeNull();
    expect(await res.json()).toEqual({ url: "http://127.0.0.1:4177/" });
  });

  it("OPTIONS+POST с Origin http://[::1]:6006 — эхо и allow-headers", async () => {
    const ipv6 = "http://[::1]:6006";
    const server = await startSidecar({
      port: 0,
      onShare: async (req) => {
        expect(req.origin).toBe("http://127.0.0.1:6006");
        return { url: "http://127.0.0.1:4177/" };
      },
    });
    stop = server.stop;

    const preflight = await fetch(server.origin + "/v1/share", {
      method: "OPTIONS",
      headers: { origin: ipv6 },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe(ipv6);
    expect(preflight.headers.get("access-control-allow-methods")).toContain("POST");
    expect(preflight.headers.get("access-control-allow-headers")).toContain(
      "content-type",
    );
    expect(preflight.headers.get("access-control-allow-credentials")).toBeNull();

    const res = await fetch(server.origin + "/v1/share", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: ipv6,
      },
      body: JSON.stringify({ origin: "http://127.0.0.1:6006" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(ipv6);
    expect(await res.json()).toEqual({ url: "http://127.0.0.1:4177/" });
  });

  it("loopback Origin + RFC1918 тело — 200 и onShare с LAN origin", async () => {
    const loopback = "http://127.0.0.1:6006";
    const lan = "http://192.168.0.10:6006";
    const server = await startSidecar({
      port: 0,
      onShare: async (req) => {
        expect(req.origin).toBe(lan);
        return { url: "http://127.0.0.1:4177/" };
      },
    });
    stop = server.stop;

    const res = await fetch(server.origin + "/v1/share", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: loopback,
      },
      body: JSON.stringify({ origin: lan, title: "LAN" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(loopback);
    expect(res.headers.get("access-control-allow-origin")).not.toBe(lan);
    expect(await res.json()).toEqual({ url: "http://127.0.0.1:4177/" });
  });

  it("OPTIONS+POST с публичным Origin — 403 forbidden-origin", async () => {
    let called = 0;
    const server = await startSidecar({
      port: 0,
      onShare: async () => {
        called += 1;
        return { url: "http://127.0.0.1:4177/" };
      },
    });
    stop = server.stop;

    const preflight = await fetch(server.origin + "/v1/share", {
      method: "OPTIONS",
      headers: { origin: "https://evil.example" },
    });
    expect(preflight.status).toBe(403);
    expect(await preflight.json()).toEqual({ error: "forbidden-origin" });
    expect(preflight.headers.get("access-control-allow-origin")).toBeNull();

    const res = await fetch(server.origin + "/v1/share", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example",
      },
      body: JSON.stringify({ origin: "http://127.0.0.1:6006" }),
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden-origin" });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(called).toBe(0);
  });

  it("OPTIONS+POST с RFC1918 Origin — 403 forbidden-origin", async () => {
    let called = 0;
    const server = await startSidecar({
      port: 0,
      onShare: async () => {
        called += 1;
        return { url: "http://127.0.0.1:4177/" };
      },
    });
    stop = server.stop;

    const preflight = await fetch(server.origin + "/v1/share", {
      method: "OPTIONS",
      headers: { origin: "http://192.168.0.10:6006" },
    });
    expect(preflight.status).toBe(403);
    expect(await preflight.json()).toEqual({ error: "forbidden-origin" });
    expect(preflight.headers.get("access-control-allow-origin")).toBeNull();

    const res = await fetch(server.origin + "/v1/share", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://192.168.0.10:6006",
      },
      body: JSON.stringify({ origin: "http://127.0.0.1:6006" }),
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden-origin" });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(called).toBe(0);
  });

  it("без Origin на OPTIONS и POST — 403 forbidden-origin", async () => {
    let called = 0;
    const server = await startSidecar({
      port: 0,
      onShare: async () => {
        called += 1;
        return { url: "http://127.0.0.1:4177/" };
      },
    });
    stop = server.stop;

    const preflight = await fetch(server.origin + "/v1/share", {
      method: "OPTIONS",
    });
    expect(preflight.status).toBe(403);
    expect(await preflight.json()).toEqual({ error: "forbidden-origin" });
    expect(preflight.headers.get("access-control-allow-origin")).toBeNull();

    const res = await fetch(server.origin + "/v1/share", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ origin: "http://127.0.0.1:6006" }),
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden-origin" });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(called).toBe(0);
  });

  it("тело с публичным origin — 400 not-local", async () => {
    const server = await startSidecar({
      port: 0,
      onShare: async () => ({ url: "http://127.0.0.1:4177/" }),
    });
    stop = server.stop;

    const remote = await fetch(server.origin + "/v1/share", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://127.0.0.1:6006",
      },
      body: JSON.stringify({ origin: "https://evil.example" }),
    });
    expect(remote.status).toBe(400);
    expect(await remote.json()).toEqual({ error: "not-local" });

    const missing = await fetch(server.origin + "/v1/share", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://127.0.0.1:6006",
      },
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
      headers: {
        "content-type": "application/json",
        origin: "http://127.0.0.1:5173",
      },
      body: JSON.stringify({ origin: "http://127.0.0.1:5173" }),
    });
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string; detail: string };
    expect(body.error).toBe("share-failed");
    expect(body.detail).toBe("boom");
  });
});
