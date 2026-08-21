import { describe, expect, it } from "vitest";
import { runRm } from "./rm.ts";

describe("runRm", () => {
  it("удаляет slug и файлы gallery", async () => {
    const lines: string[] = [];
    const removed: string[] = [];
    const files: { outRoot: string; slug: string }[] = [];
    const result = await runRm({
      slug: "checkout",
      outDir: "/tmp/protoshare/out",
      removeShare: async ({ slug }) => {
        removed.push(slug);
        return { ok: true, slug };
      },
      removeGalleryDir: async ({ outRoot, slug }) => {
        files.push({ outRoot, slug });
        return { ok: true, dir: `${outRoot}/${slug}`, removed: true };
      },
      log: (line) => lines.push(line),
    });
    expect(result).toEqual({ ok: true, slug: "checkout", files: "removed" });
    expect(removed).toEqual(["checkout"]);
    expect(files).toEqual([{ outRoot: "/tmp/protoshare/out", slug: "checkout" }]);
    expect(lines.join("\n")).toContain("checkout");
    expect(lines.join("\n")).toMatch(/files/i);
  });

  it("нет slug — ok:false без вызова каталога", async () => {
    let called = 0;
    const errors: string[] = [];
    const result = await runRm({
      slug: "  ",
      removeShare: async () => {
        called += 1;
        return { ok: true, slug: "x" };
      },
      error: (line) => errors.push(line),
    });
    expect(result.ok).toBe(false);
    expect(called).toBe(0);
    expect(errors.join("\n")).toMatch(/slug/i);
  });

  it("нет записи — ok:false без throw и без файлов", async () => {
    const errors: string[] = [];
    let files = 0;
    const result = await runRm({
      slug: "gone",
      removeShare: async () => ({ ok: false, detail: "шара «gone» не найдена" }),
      removeGalleryDir: async () => {
        files += 1;
        return { ok: true, dir: "/x", removed: true };
      },
      error: (line) => errors.push(line),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.detail).toContain("gone");
    expect(files).toBe(0);
    expect(errors.join("\n")).toMatch(/пропуск/);
  });

  it("--no-files не трогает gallery", async () => {
    let files = 0;
    const result = await runRm({
      slug: "checkout",
      files: false,
      removeShare: async () => ({ ok: true, slug: "checkout" }),
      removeGalleryDir: async () => {
        files += 1;
        return { ok: true, dir: "/x", removed: true };
      },
      log: () => {},
    });
    expect(result).toEqual({ ok: true, slug: "checkout", files: "skipped" });
    expect(files).toBe(0);
  });

  it("нет каталога файлов — всё равно ok", async () => {
    const lines: string[] = [];
    const result = await runRm({
      slug: "checkout",
      outDir: "/tmp/out",
      removeShare: async () => ({ ok: true, slug: "checkout" }),
      removeGalleryDir: async () => ({ ok: true, dir: "/tmp/out/checkout", removed: false }),
      log: (line) => lines.push(line),
    });
    expect(result).toEqual({ ok: true, slug: "checkout", files: "missing" });
    expect(lines.join("\n")).toMatch(/пропуск/);
  });

  it("ошибка каталога — ok:false без throw", async () => {
    const errors: string[] = [];
    const result = await runRm({
      slug: "checkout",
      removeShare: async () => {
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
