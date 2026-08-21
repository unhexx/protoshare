import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  listShares,
  recordShare,
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
