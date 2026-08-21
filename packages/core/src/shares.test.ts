import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  listShares,
  recordShare,
  removeShare,
  sharesConfigFromEnv,
} from "./shares.ts";

describe("sharesConfigFromEnv", () => {
  it("берёт PROTOSHARE_LIBSQL_URL и токен", () => {
    expect(
      sharesConfigFromEnv({
        PROTOSHARE_LIBSQL_URL: "file:/tmp/shares.db",
        PROTOSHARE_LIBSQL_AUTH_TOKEN: "tok",
      }),
    ).toEqual({ url: "file:/tmp/shares.db", authToken: "tok" });
  });

  it("TURSO_* как запасной вариант", () => {
    expect(
      sharesConfigFromEnv({
        TURSO_DATABASE_URL: "libsql://ex.turso.io",
        TURSO_AUTH_TOKEN: "t",
      }),
    ).toEqual({ url: "libsql://ex.turso.io", authToken: "t" });
  });

  it("по умолчанию — локальный sqlite", () => {
    expect(sharesConfigFromEnv({})).toEqual({ url: "file:.protoshare/shares.db" });
  });
});

describe("recordShare", () => {
  it("пишет и читает шару", async () => {
    const dir = await mkdtemp(join(tmpdir(), "protoshare-shares-"));
    const config = { url: `file:${join(dir, "shares.db")}` };
    const rec = await recordShare({
      slug: "checkout",
      title: "Checkout",
      origin: "http://127.0.0.1:6006",
      url: "https://example.com/checkout/gallery.tgz",
      createdAt: new Date("2026-08-21T14:00:00.000Z"),
      config,
    });
    expect(rec.ok).toBe(true);
    if (!rec.ok) return;
    expect(rec.share).toEqual({
      slug: "checkout",
      title: "Checkout",
      origin: "http://127.0.0.1:6006",
      url: "https://example.com/checkout/gallery.tgz",
      createdAt: "2026-08-21T14:00:00.000Z",
    });
    await expect(listShares({ config })).resolves.toEqual([rec.share]);
  });

  it("тот же slug обновляет запись", async () => {
    const dir = await mkdtemp(join(tmpdir(), "protoshare-shares-"));
    const config = { url: `file:${join(dir, "shares.db")}` };
    await recordShare({
      slug: "preview",
      title: "Old",
      origin: "http://127.0.0.1:5173",
      createdAt: new Date("2026-08-21T10:00:00.000Z"),
      config,
    });
    const rec = await recordShare({
      slug: "preview",
      title: "New",
      origin: "http://127.0.0.1:6006",
      url: "https://cdn.example/preview.tgz",
      createdAt: new Date("2026-08-21T14:00:00.000Z"),
      config,
    });
    expect(rec.ok).toBe(true);
    const list = await listShares({ config });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      slug: "preview",
      title: "New",
      origin: "http://127.0.0.1:6006",
      url: "https://cdn.example/preview.tgz",
      createdAt: "2026-08-21T14:00:00.000Z",
    });
  });

  it("не затирает S3 live/gallery URL при повторной шаре", async () => {
    const dir = await mkdtemp(join(tmpdir(), "protoshare-shares-"));
    const config = { url: `file:${join(dir, "shares.db")}` };
    await recordShare({
      slug: "checkout",
      title: "Checkout",
      origin: "http://127.0.0.1:6006",
      url: "https://cdn.example/checkout.tgz",
      createdAt: new Date("2026-08-21T10:00:00.000Z"),
      config,
    });
    const rec = await recordShare({
      slug: "checkout",
      title: "Checkout",
      origin: "http://127.0.0.1:6006",
      url: "https://checkout.share.zrok.io",
      createdAt: new Date("2026-08-21T14:00:00.000Z"),
      config,
    });
    expect(rec.ok).toBe(true);
    if (!rec.ok) return;
    expect(rec.share.url).toBe("https://cdn.example/checkout.tgz");
    const list = await listShares({ config });
    expect(list[0]?.url).toBe("https://cdn.example/checkout.tgz");
  });

  it("remote URL заменяет прежний live", async () => {
    const dir = await mkdtemp(join(tmpdir(), "protoshare-shares-"));
    const config = { url: `file:${join(dir, "shares.db")}` };
    await recordShare({
      slug: "checkout",
      title: "Checkout",
      origin: "http://127.0.0.1:6006",
      url: "https://checkout.share.zrok.io",
      config,
    });
    const rec = await recordShare({
      slug: "checkout",
      title: "Checkout",
      origin: "http://127.0.0.1:6006",
      url: "https://cdn.example/checkout.tgz",
      config,
    });
    expect(rec.ok).toBe(true);
    if (!rec.ok) return;
    expect(rec.share.url).toBe("https://cdn.example/checkout.tgz");
  });

  it("битый url — ok:false без throw", async () => {
    const rec = await recordShare({
      slug: "x",
      title: "X",
      origin: "http://127.0.0.1:1",
      config: { url: "not-a-libsql-url" },
    });
    expect(rec.ok).toBe(false);
    if (rec.ok) return;
    expect(rec.detail.length).toBeGreaterThan(0);
  });
});

describe("removeShare", () => {
  it("удаляет шару из каталога", async () => {
    const dir = await mkdtemp(join(tmpdir(), "protoshare-shares-"));
    const config = { url: `file:${join(dir, "shares.db")}` };
    await recordShare({
      slug: "checkout",
      title: "Checkout",
      origin: "http://127.0.0.1:6006",
      config,
    });
    await recordShare({
      slug: "preview",
      title: "Vite",
      origin: "http://127.0.0.1:5173",
      config,
    });
    const removed = await removeShare({ slug: "checkout", config });
    expect(removed).toEqual({ ok: true, slug: "checkout" });
    const list = await listShares({ config });
    expect(list.map((row) => row.slug)).toEqual(["preview"]);
  });

  it("нет slug — ok:false без throw", async () => {
    const dir = await mkdtemp(join(tmpdir(), "protoshare-shares-"));
    const config = { url: `file:${join(dir, "shares.db")}` };
    const missing = await removeShare({ slug: "gone", config });
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.detail.toLowerCase()).toContain("gone");
    await expect(listShares({ config })).resolves.toEqual([]);
  });

  it("пустой slug — ok:false без открытия БД", async () => {
    const removed = await removeShare({
      slug: "   ",
      config: { url: "not-a-libsql-url" },
    });
    expect(removed.ok).toBe(false);
    if (removed.ok) return;
    expect(removed.detail.toLowerCase()).toContain("slug");
  });

  it("битый url — ok:false без throw", async () => {
    const removed = await removeShare({
      slug: "checkout",
      config: { url: "not-a-libsql-url" },
    });
    expect(removed.ok).toBe(false);
    if (removed.ok) return;
    expect(removed.detail.length).toBeGreaterThan(0);
  });
});
