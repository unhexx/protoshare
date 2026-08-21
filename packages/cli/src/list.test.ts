import { describe, expect, it } from "vitest";
import type { ShareRow } from "@protoshare/core";
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
  });
});

describe("runList", () => {
  it("пишет форматированный список", async () => {
    const lines: string[] = [];
    const result = await runList({
      listShares: async () => [checkout],
      log: (line) => lines.push(line),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.count).toBe(1);
    expect(lines.join("\n")).toContain("checkout");
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
