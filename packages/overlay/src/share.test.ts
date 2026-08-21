import { describe, expect, it } from "vitest";
import {
  clipboardTextForShare,
  DEFAULT_SHARE_TIMEOUT_MS,
  requestShare,
  shareCommand,
  shareEndpoint,
  statusForShare,
  storyIdFromLocation,
} from "./share.ts";

describe("requestShare", () => {
  it("собирает команду CLI и URL сайдкара", () => {
    expect(shareCommand("http://127.0.0.1:6006")).toBe(
      "npx protoshare http://127.0.0.1:6006",
    );
    expect(shareEndpoint("http://127.0.0.1:4178/")).toBe(
      "http://127.0.0.1:4178/v1/share",
    );
    expect(DEFAULT_SHARE_TIMEOUT_MS).toBe(120_000);
  });

  it("возвращает url с сайдкара", async () => {
    const result = await requestShare({
      origin: "http://127.0.0.1:6006",
      title: "Button",
      storyId: "button--primary",
      fetchImpl: async (input, init) => {
        expect(String(input)).toBe("http://127.0.0.1:4178/v1/share");
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({
          origin: "http://127.0.0.1:6006",
          title: "Button",
          storyId: "button--primary",
        });
        return new Response(
          JSON.stringify({ url: "http://127.0.0.1:4177/button/", captured: 3, total: 40 }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      },
    });
    expect(result).toEqual({
      ok: true,
      url: "http://127.0.0.1:4177/button/",
      captured: 3,
      total: 40,
    });
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

  it("409 share-in-progress без команды CLI", async () => {
    const result = await requestShare({
      origin: "http://127.0.0.1:6006",
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: "share-in-progress" }), { status: 409 }),
    });
    expect(result).toEqual({ ok: false, reason: "share-in-progress" });
    expect(result).not.toHaveProperty("command");
  });
});

describe("statusForShare", () => {
  it("без captured/total не пишет Captured undefined", () => {
    expect(statusForShare({ ok: true, url: "http://127.0.0.1:4177/" })).toBe(
      "http://127.0.0.1:4177/",
    );
    expect(statusForShare({ ok: true, url: "http://x" })).not.toContain("undefined");
    expect(
      statusForShare({ ok: true, url: "http://x", captured: 3, total: 40 }),
    ).toBe("Captured 3 / 40 stories");
  });

  it("409 не копирует npx protoshare", () => {
    const busy = { ok: false as const, reason: "share-in-progress" as const };
    expect(statusForShare(busy)).toBe("Share already in progress");
    expect(clipboardTextForShare(busy)).toBeUndefined();
    expect(clipboardTextForShare({ ok: true, url: "http://u" })).toBe("http://u");
  });
});

describe("storyIdFromLocation", () => {
  it("берёт id=, иначе path=/story/...", () => {
    expect(storyIdFromLocation("?id=button--primary&viewMode=story")).toBe(
      "button--primary",
    );
    expect(storyIdFromLocation("?path=/story/example-button--primary")).toBe(
      "example-button--primary",
    );
    expect(storyIdFromLocation("")).toBeUndefined();
  });
});
