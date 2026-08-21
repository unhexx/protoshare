import { describe, expect, it } from "vitest";
import { persistShare, resolveShareUrl } from "./share-url.ts";

const live = "https://checkout.share.zrok.io";
const remote = "https://cdn.example/checkout/gallery.tgz";
const gallery = "http://127.0.0.1:4177";

describe("resolveShareUrl", () => {
  it("session: live > remote > gallery", () => {
    expect(resolveShareUrl({ live, remote, gallery }, "session")).toBe(live);
    expect(resolveShareUrl({ live, remote }, "session")).toBe(live);
    expect(resolveShareUrl({ live, gallery }, "session")).toBe(live);
    expect(resolveShareUrl({ remote, gallery }, "session")).toBe(remote);
    expect(resolveShareUrl({ live }, "session")).toBe(live);
    expect(resolveShareUrl({ remote }, "session")).toBe(remote);
    expect(resolveShareUrl({ gallery }, "session")).toBe(gallery);
    expect(resolveShareUrl({}, "session")).toBeUndefined();
  });

  it("catalog: remote > live > gallery", () => {
    expect(resolveShareUrl({ live, remote, gallery }, "catalog")).toBe(remote);
    expect(resolveShareUrl({ live, remote }, "catalog")).toBe(remote);
    expect(resolveShareUrl({ remote, gallery }, "catalog")).toBe(remote);
    expect(resolveShareUrl({ live, gallery }, "catalog")).toBe(live);
    expect(resolveShareUrl({ live }, "catalog")).toBe(live);
    expect(resolveShareUrl({ remote }, "catalog")).toBe(remote);
    expect(resolveShareUrl({ gallery }, "catalog")).toBe(gallery);
    expect(resolveShareUrl({}, "catalog")).toBeUndefined();
  });

  it("пустые и пробельные строки не считаются URL", () => {
    expect(resolveShareUrl({ live: "", remote, gallery }, "session")).toBe(remote);
    expect(resolveShareUrl({ live, remote: "", gallery }, "catalog")).toBe(live);
    expect(resolveShareUrl({ live: "  ", remote, gallery }, "session")).toBe(remote);
    expect(resolveShareUrl({ live, remote: "\t", gallery }, "catalog")).toBe(live);
    expect(resolveShareUrl({ live: "  https://a.share.zrok.io  " }, "session")).toBe(
      "https://a.share.zrok.io",
    );
    expect(resolveShareUrl({ live: "", remote: "", gallery: "" }, "session")).toBeUndefined();
    expect(resolveShareUrl({ live: "", remote: "", gallery: "" }, "catalog")).toBeUndefined();
  });
});

describe("persistShare", () => {
  it("в каталог пишет remote, session остаётся live", async () => {
    const recorded: Array<{ slug: string; title: string; origin: string; url?: string }> = [];
    const result = await persistShare({
      slug: "checkout",
      title: "Checkout",
      origin: "http://127.0.0.1:6006",
      live,
      remote,
      gallery,
      recordShare: async (input) => {
        recorded.push(input);
        return {
          ok: true,
          share: {
            slug: input.slug,
            title: input.title,
            origin: input.origin,
            url: input.url,
            createdAt: "2026-08-21T14:00:00.000Z",
          },
        };
      },
    });
    expect(result.sessionUrl).toBe(live);
    expect(result.catalogUrl).toBe(remote);
    expect(recorded).toEqual([
      {
        slug: "checkout",
        title: "Checkout",
        origin: "http://127.0.0.1:6006",
        url: remote,
      },
    ]);
  });

  it("только remote — и catalog, и session", async () => {
    const recorded: Array<{ url?: string }> = [];
    const result = await persistShare({
      slug: "checkout",
      title: "Checkout",
      origin: "http://127.0.0.1:6006",
      remote,
      recordShare: async (input) => {
        recorded.push(input);
        return {
          ok: true,
          share: {
            slug: input.slug,
            title: input.title,
            origin: input.origin,
            url: input.url,
            createdAt: "2026-08-21T14:00:00.000Z",
          },
        };
      },
    });
    expect(result.sessionUrl).toBe(remote);
    expect(result.catalogUrl).toBe(remote);
    expect(recorded[0]?.url).toBe(remote);
  });

  it("без remote каталог и session берут live", async () => {
    const recorded: Array<{ url?: string }> = [];
    const result = await persistShare({
      slug: "checkout",
      title: "Checkout",
      origin: "http://127.0.0.1:6006",
      live,
      gallery,
      recordShare: async (input) => {
        recorded.push(input);
        return {
          ok: true,
          share: {
            slug: input.slug,
            title: input.title,
            origin: input.origin,
            url: input.url,
            createdAt: "2026-08-21T14:00:00.000Z",
          },
        };
      },
    });
    expect(result.sessionUrl).toBe(live);
    expect(result.catalogUrl).toBe(live);
    expect(recorded[0]?.url).toBe(live);
  });
});
