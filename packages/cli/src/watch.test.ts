import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createWatchHandler } from "./watch.ts";

describe("createWatchHandler", () => {
  it("снимает origin и возвращает gallery URL", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "protoshare-watch-"));
    const captured: string[] = [];
    const handler = createWatchHandler({
      outDir,
      galleryPort: 0,
      detectTarget: async (origin) => ({
        kind: "vite",
        origin,
        title: "Vite",
        stories: [],
      }),
      captureTarget: async (input) => {
        captured.push(input.origin);
        return [{ id: "preview", title: "Preview", file: join(outDir, "x.png") }];
      },
      writeGallery: async (input) => ({ slug: input.slug ?? "vite", outDir: input.outDir }),
      startShareServer: async () => ({
        origin: "http://127.0.0.1:4177",
        stop: async () => {},
      }),
    });

    const result = await handler.onShare({ origin: "http://127.0.0.1:5173" });
    expect(result.url).toBe("http://127.0.0.1:4177");
    expect(captured).toEqual(["http://127.0.0.1:5173"]);
    await handler.stop();
  });

  it("перед новым шаром останавливает предыдущую gallery", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "protoshare-watch-"));
    let stops = 0;
    let starts = 0;
    const handler = createWatchHandler({
      outDir,
      galleryPort: 0,
      detectTarget: async (origin) => ({
        kind: "static",
        origin,
        title: "Preview",
        stories: [],
      }),
      captureTarget: async () => [],
      writeGallery: async (input) => ({ slug: "preview", outDir: input.outDir }),
      startShareServer: async () => {
        starts += 1;
        return {
          origin: `http://127.0.0.1:417${starts}`,
          stop: async () => {
            stops += 1;
          },
        };
      },
    });

    await handler.onShare({ origin: "http://127.0.0.1:6006" });
    expect(starts).toBe(1);
    expect(stops).toBe(0);

    const second = await handler.onShare({ origin: "http://127.0.0.1:5173" });
    expect(starts).toBe(2);
    expect(stops).toBe(1);
    expect(second.url).toBe("http://127.0.0.1:4172");

    await handler.stop();
    expect(stops).toBe(2);
  });

  it("если zrok поднялся — отдаёт публичный URL", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "protoshare-watch-"));
    const handler = createWatchHandler({
      outDir,
      galleryPort: 0,
      detectTarget: async (origin) => ({
        kind: "vite",
        origin,
        title: "Checkout",
        stories: [],
      }),
      captureTarget: async () => [],
      writeGallery: async (input) => ({ slug: "checkout", outDir: input.outDir }),
      startShareServer: async () => ({
        origin: "http://127.0.0.1:4177",
        stop: async () => {},
      }),
      uniqueName: (slug) => slug,
      tryZrokShare: async (opts) => {
        expect(opts.localOrigin).toBe("http://127.0.0.1:4177");
        expect(opts.uniqueName).toBe("checkout");
        return {
          ok: true,
          url: "https://checkout.share.zrok.io",
          stop: async () => {},
        };
      },
    });

    const result = await handler.onShare({ origin: "http://127.0.0.1:5173" });
    expect(result.url).toBe("https://checkout.share.zrok.io");
    await handler.stop();
  });

  it("если zrok недоступен — остаётся локальная gallery", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "protoshare-watch-"));
    const handler = createWatchHandler({
      outDir,
      galleryPort: 0,
      detectTarget: async (origin) => ({
        kind: "vite",
        origin,
        title: "Vite",
        stories: [],
      }),
      captureTarget: async () => [],
      writeGallery: async (input) => ({ slug: "vite", outDir: input.outDir }),
      startShareServer: async () => ({
        origin: "http://127.0.0.1:4177",
        stop: async () => {},
      }),
      tryZrokShare: async () => ({ ok: false, detail: "zrok не найден в PATH" }),
    });

    const result = await handler.onShare({ origin: "http://127.0.0.1:5173" });
    expect(result.url).toBe("http://127.0.0.1:4177");
    await handler.stop();
  });

  it("перед новым шаром гасит предыдущий live-туннель", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "protoshare-watch-"));
    let liveStops = 0;
    const handler = createWatchHandler({
      outDir,
      galleryPort: 0,
      detectTarget: async (origin) => ({
        kind: "static",
        origin,
        title: "Preview",
        stories: [],
      }),
      captureTarget: async () => [],
      writeGallery: async (input) => ({ slug: "preview", outDir: input.outDir }),
      startShareServer: async () => ({
        origin: "http://127.0.0.1:4177",
        stop: async () => {},
      }),
      tryZrokShare: async () => ({
        ok: true as const,
        url: "https://live.share.zrok.io",
        stop: async () => {
          liveStops += 1;
        },
      }),
    });

    await handler.onShare({ origin: "http://127.0.0.1:6006" });
    expect(liveStops).toBe(0);
    await handler.onShare({ origin: "http://127.0.0.1:5173" });
    expect(liveStops).toBe(1);
    await handler.stop();
    expect(liveStops).toBe(2);
  });

  it("при --no-live не зовёт zrok", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "protoshare-watch-"));
    let called = 0;
    const handler = createWatchHandler({
      outDir,
      galleryPort: 0,
      live: false,
      detectTarget: async (origin) => ({
        kind: "vite",
        origin,
        title: "Vite",
        stories: [],
      }),
      captureTarget: async () => [],
      writeGallery: async (input) => ({ slug: "vite", outDir: input.outDir }),
      startShareServer: async () => ({
        origin: "http://127.0.0.1:4177",
        stop: async () => {},
      }),
      tryZrokShare: async () => {
        called += 1;
        return { ok: true, url: "https://nope.share.zrok.io", stop: async () => {} };
      },
    });

    const result = await handler.onShare({ origin: "http://127.0.0.1:5173" });
    expect(called).toBe(0);
    expect(result.url).toBe("http://127.0.0.1:4177");
    await handler.stop();
  });

  it("пишет шару в каталог с публичным URL", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "protoshare-watch-"));
    const recorded: Array<{ slug: string; title: string; origin: string; url?: string }> = [];
    const handler = createWatchHandler({
      outDir,
      galleryPort: 0,
      detectTarget: async (origin) => ({
        kind: "vite",
        origin,
        title: "Checkout",
        stories: [],
      }),
      captureTarget: async () => [],
      writeGallery: async (input) => ({ slug: input.slug ?? "checkout", outDir: input.outDir }),
      startShareServer: async () => ({
        origin: "http://127.0.0.1:4177",
        stop: async () => {},
      }),
      tryZrokShare: async () => ({
        ok: true,
        url: "https://checkout.share.zrok.io",
        stop: async () => {},
      }),
      recordShare: async (input) => {
        recorded.push(input);
        return { ok: true };
      },
    });

    const result = await handler.onShare({ origin: "http://127.0.0.1:5173" });
    expect(result.url).toBe("https://checkout.share.zrok.io");
    expect(recorded).toEqual([
      {
        slug: "checkout",
        title: "Checkout",
        origin: "http://127.0.0.1:5173",
        url: "https://checkout.share.zrok.io",
      },
    ]);
    await handler.stop();
  });

  it("ошибка каталога не ломает шар", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "protoshare-watch-"));
    const handler = createWatchHandler({
      outDir,
      galleryPort: 0,
      detectTarget: async (origin) => ({
        kind: "vite",
        origin,
        title: "Vite",
        stories: [],
      }),
      captureTarget: async () => [],
      writeGallery: async (input) => ({ slug: "vite", outDir: input.outDir }),
      startShareServer: async () => ({
        origin: "http://127.0.0.1:4177",
        stop: async () => {},
      }),
      recordShare: async () => {
        throw new Error("libsql down");
      },
    });

    const result = await handler.onShare({ origin: "http://127.0.0.1:5173" });
    expect(result.url).toBe("http://127.0.0.1:4177");
    await handler.stop();
  });
});
