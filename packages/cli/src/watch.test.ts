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
});
