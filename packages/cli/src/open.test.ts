import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeGallery } from "@protoshare/core";
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
