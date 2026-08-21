import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listShares, recordShare, writeGallery } from "@protoshare/core";
import { startShareServer } from "@protoshare/share-app";
import { runOpen } from "./open.ts";

describe("runOpen", () => {
  it("нет slug — ok:false без сервера", async () => {
    let started = 0;
    const errors: string[] = [];
    const result = await runOpen({
      slug: "  ",
      startShareServer: async () => {
        started += 1;
        return { origin: "http://127.0.0.1:9", stop: async () => {} };
      },
      error: (line) => errors.push(line),
    });
    expect(result.ok).toBe(false);
    expect(started).toBe(0);
    expect(errors.join("\n")).toMatch(/slug/i);
  });

  it("нет gallery — ok:false без сервера", async () => {
    let started = 0;
    const errors: string[] = [];
    const result = await runOpen({
      slug: "gone",
      outDir: "/tmp/protoshare-no-such-out",
      startShareServer: async () => {
        started += 1;
        return { origin: "http://127.0.0.1:9", stop: async () => {} };
      },
      error: (line) => errors.push(line),
    });
    expect(result.ok).toBe(false);
    expect(started).toBe(0);
    expect(errors.join("\n")).toMatch(/пропуск/);
  });

  it("поднимает сервер для найденной gallery", async () => {
    const lines: string[] = [];
    const roots: string[] = [];
    const result = await runOpen({
      slug: "checkout",
      outDir: "/tmp/out",
      port: 4177,
      findGalleryDir: async () => ({
        ok: true,
        dir: "/tmp/out/checkout",
        slug: "checkout",
      }),
      live: false,
      startShareServer: async ({ root, port }) => {
        roots.push(root);
        expect(port).toBe(4177);
        return { origin: "http://127.0.0.1:4177", stop: async () => {} };
      },
      log: (line) => lines.push(line),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.origin).toBe("http://127.0.0.1:4177");
    expect(result.slug).toBe("checkout");
    expect(roots).toEqual(["/tmp/out/checkout"]);
    expect(lines.join("\n")).toContain("http://127.0.0.1:4177");
  });

  it("ошибка сервера — ok:false без throw", async () => {
    const errors: string[] = [];
    const result = await runOpen({
      slug: "checkout",
      findGalleryDir: async () => ({ ok: true, dir: "/tmp/out/checkout", slug: "checkout" }),
      startShareServer: async () => {
        throw new Error("EADDRINUSE");
      },
      error: (line) => errors.push(line),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.detail).toContain("EADDRINUSE");
    expect(errors.join("\n")).toMatch(/пропуск/);
  });

  it("если zrok поднялся — отдаёт публичный URL", async () => {
    const lines: string[] = [];
    let liveStops = 0;
    let galleryStops = 0;
    const result = await runOpen({
      slug: "checkout",
      findGalleryDir: async () => ({ ok: true, dir: "/tmp/out/checkout", slug: "checkout" }),
      startShareServer: async () => ({
        origin: "http://127.0.0.1:4177",
        stop: async () => {
          galleryStops += 1;
        },
      }),
      uniqueName: (slug) => slug,
      tryLiveShare: async (opts) => {
        expect(opts.localOrigin).toBe("http://127.0.0.1:4177");
        expect(opts.uniqueName).toBe("checkout");
        return {
          ok: true,
          provider: "zrok",
          url: "https://checkout.share.zrok.io",
          stop: async () => {
            liveStops += 1;
          },
        };
      },
      log: (line) => lines.push(line),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.origin).toBe("https://checkout.share.zrok.io");
    expect(lines.join("\n")).toMatch(/Live:\s+zrok\s+https:\/\/checkout\.share\.zrok\.io/);
    await result.stop();
    expect(liveStops).toBe(1);
    expect(galleryStops).toBe(1);
  });

  it("open --live не пишет и не обновляет каталог libsql", async () => {
    const dir = await mkdtemp(join(tmpdir(), "protoshare-open-catalog-"));
    const config = { url: `file:${join(dir, "shares.db")}` };
    const seeded = await recordShare({
      slug: "checkout",
      title: "Old",
      origin: "http://127.0.0.1:6006",
      url: "https://cdn.example/checkout.tgz",
      createdAt: new Date("2026-08-21T10:00:00.000Z"),
      config,
    });
    expect(seeded.ok).toBe(true);
    const before = await listShares({ config });
    const prev = process.env.PROTOSHARE_LIBSQL_URL;
    process.env.PROTOSHARE_LIBSQL_URL = config.url;
    const lines: string[] = [];
    try {
      const result = await runOpen({
        slug: "checkout",
        findGalleryDir: async () => ({ ok: true, dir: "/tmp/out/checkout", slug: "checkout" }),
        startShareServer: async () => ({
          origin: "http://127.0.0.1:4177",
          stop: async () => {},
        }),
        tryLiveShare: async () => ({
          ok: true,
          provider: "zrok",
          url: "https://checkout.share.zrok.io",
          stop: async () => {},
        }),
        log: (line) => lines.push(line),
      });
      expect(result.ok).toBe(true);
      if (result.ok) await result.stop();
    } finally {
      if (prev === undefined) delete process.env.PROTOSHARE_LIBSQL_URL;
      else process.env.PROTOSHARE_LIBSQL_URL = prev;
    }
    await expect(listShares({ config })).resolves.toEqual(before);
    expect(lines.join("\n")).not.toMatch(/catalog/i);
  });

  it("если zrok недоступен — остаётся локальная gallery", async () => {
    const lines: string[] = [];
    const result = await runOpen({
      slug: "checkout",
      findGalleryDir: async () => ({ ok: true, dir: "/tmp/out/checkout", slug: "checkout" }),
      startShareServer: async () => ({
        origin: "http://127.0.0.1:4177",
        stop: async () => {},
      }),
      tryLiveShare: async () => ({ ok: false, detail: "zrok не найден в PATH" }),
      log: (line) => lines.push(line),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.origin).toBe("http://127.0.0.1:4177");
    expect(lines.join("\n")).toMatch(/пропуск/);
  });

  it("при --no-live не зовёт zrok", async () => {
    let called = 0;
    const result = await runOpen({
      slug: "checkout",
      live: false,
      findGalleryDir: async () => ({ ok: true, dir: "/tmp/out/checkout", slug: "checkout" }),
      startShareServer: async () => ({
        origin: "http://127.0.0.1:4177",
        stop: async () => {},
      }),
      tryLiveShare: async () => {
        called += 1;
        return {
          ok: true,
          provider: "zrok",
          url: "https://nope.share.zrok.io",
          stop: async () => {},
        };
      },
      log: () => {},
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.origin).toBe("http://127.0.0.1:4177");
    expect(called).toBe(0);
  });
});

describe("runOpen integration", () => {
  let stop: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await stop?.();
    stop = undefined;
  });

  it("отдаёт сохранённый index.html", async () => {
    const root = await mkdtemp(join(tmpdir(), "protoshare-open-"));
    await writeGallery({
      outDir: join(root, "checkout"),
      title: "Checkout",
      origin: "http://127.0.0.1:6006",
      slug: "checkout",
      shots: [],
    });
    const result = await runOpen({
      slug: "checkout",
      outDir: root,
      port: 0,
      live: false,
      startShareServer,
      log: () => {},
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    stop = result.stop;
    const res = await fetch(`${result.origin}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Checkout");
  });
});
