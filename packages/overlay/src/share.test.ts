import { describe, expect, it } from "vitest";
import { requestShare, shareCommand, shareEndpoint } from "./share.ts";

describe("requestShare", () => {
  it("собирает команду CLI и URL сайдкара", () => {
    expect(shareCommand("http://127.0.0.1:6006")).toBe(
      "npx protoshare http://127.0.0.1:6006",
    );
    expect(shareEndpoint("http://127.0.0.1:4178/")).toBe(
      "http://127.0.0.1:4178/v1/share",
    );
  });

  it("возвращает url с сайдкара", async () => {
    const result = await requestShare({
      origin: "http://127.0.0.1:6006",
      title: "Button",
      fetchImpl: async (input, init) => {
        expect(String(input)).toBe("http://127.0.0.1:4178/v1/share");
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({
          origin: "http://127.0.0.1:6006",
          title: "Button",
        });
        return new Response(JSON.stringify({ url: "http://127.0.0.1:4177/button/" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });
    expect(result).toEqual({ ok: true, url: "http://127.0.0.1:4177/button/" });
  });

  it("если сайдкар недоступен — отдаёт команду CLI", async () => {
    const result = await requestShare({
      origin: "http://127.0.0.1:5173",
      fetchImpl: async () => {
        throw new Error("ECONNREFUSED");
      },
    });
    expect(result).toEqual({
      ok: false,
      reason: "sidecar-down",
      command: "npx protoshare http://127.0.0.1:5173",
    });
  });

  it("если сайдкар ответил ошибкой — тоже fallback на CLI", async () => {
    const result = await requestShare({
      origin: "http://127.0.0.1:5173",
      fetchImpl: async () => new Response("nope", { status: 501 }),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("bad-response");
    expect(result.command).toContain("npx protoshare");
  });
});
