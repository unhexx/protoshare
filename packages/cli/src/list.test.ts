import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeGallery, type ShareRow } from "@protoshare/core";
import { formatShareList, runList } from "./list.ts";

const checkout: ShareRow = {
  slug: "checkout",
  title: "Checkout",
  origin: "http://127.0.0.1:6006",
  url: "https://example.com/checkout/gallery.tgz",
  createdAt: "2026-08-21T14:00:00.000Z",
};

describe("formatShareList", () => {
  it("пустой каталог — подсказка", () => {
    expect(formatShareList([])).toBe("Нет шар в каталоге.");
  });

  it("печатает slug, url и title", () => {
    const text = formatShareList([
      checkout,
      {
        slug: "preview",
        title: "Vite",
        origin: "http://127.0.0.1:5173",
        createdAt: "2026-08-21T13:00:00.000Z",
      },
    ]);
    expect(text).toContain("checkout");
    expect(text).toContain("https://example.com/checkout/gallery.tgz");
    expect(text).toContain("Checkout");
    expect(text).toContain("preview");
    expect(text).toContain("http://127.0.0.1:5173");
    expect(text).not.toMatch(/local/);
  });

  it("помечает шары с локальными файлами", () => {
    const text = formatShareList([{ ...checkout, local: true }]);
    expect(text).toMatch(/checkout\s+.*\slocal$/m);
  });
});

describe("runList", () => {
  it("пишет форматированный список", async () => {
    const lines: string[] = [];
    const result = await runList({
      listShares: async () => [checkout],
      hasLocal: async () => false,
      log: (line) => lines.push(line),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.count).toBe(1);
    expect(lines.join("\n")).toContain("checkout");
  });

  it("--json печатает массив записей", async () => {
    const lines: string[] = [];
    const result = await runList({
      json: true,
      listShares: async () => [checkout],
      hasLocal: async () => false,
      log: (line) => lines.push(line),
    });
    expect(result.ok).toBe(true);
    const parsed = JSON.parse(lines.join("\n")) as Array<ShareRow & { local: boolean }>;
    expect(parsed).toEqual([{ ...checkout, local: false }]);
  });

  it("local:true если есть gallery на диске", async () => {
    const lines: string[] = [];
    const slugs: string[] = [];
    await runList({
      json: true,
      listShares: async () => [checkout],
      hasLocal: async (slug) => {
        slugs.push(slug);
        return slug === "checkout";
      },
      log: (line) => lines.push(line),
    });
    expect(slugs).toEqual(["checkout"]);
    const parsed = JSON.parse(lines.join("\n")) as Array<{ local: boolean }>;
    expect(parsed[0]?.local).toBe(true);
  });

  it("--json на пустом каталоге — []", async () => {
    const lines: string[] = [];
    await runList({
      json: true,
      listShares: async () => [],
      log: (line) => lines.push(line),
    });
    expect(JSON.parse(lines.join("\n"))).toEqual([]);
  });

  it("реально видит файлы gallery", async () => {
    const root = await mkdtemp(join(tmpdir(), "protoshare-list-"));
    await writeGallery({
      outDir: join(root, "checkout"),
      title: "Checkout",
      origin: "http://127.0.0.1:6006",
      slug: "checkout",
      shots: [],
    });
    const lines: string[] = [];
    await runList({
      json: true,
      outDir: root,
      listShares: async () => [checkout],
      log: (line) => lines.push(line),
    });
    const parsed = JSON.parse(lines.join("\n")) as Array<{ local: boolean }>;
    expect(parsed[0]?.local).toBe(true);
  });

  it("ошибка каталога — ok:false без throw", async () => {
    const errors: string[] = [];
    const result = await runList({
      listShares: async () => {
        throw new Error("libsql down");
      },
      error: (line) => errors.push(line),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.detail).toContain("libsql down");
    expect(errors.join("\n")).toMatch(/пропуск/);
  });
});
