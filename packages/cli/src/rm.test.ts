import { describe, expect, it } from "vitest";
import { runRm } from "./rm.ts";

describe("runRm", () => {
  it("удаляет slug и печатает подтверждение", async () => {
    const lines: string[] = [];
    const removed: string[] = [];
    const result = await runRm({
      slug: "checkout",
      removeShare: async ({ slug }) => {
        removed.push(slug);
        return { ok: true, slug };
      },
      log: (line) => lines.push(line),
    });
    expect(result).toEqual({ ok: true, slug: "checkout" });
    expect(removed).toEqual(["checkout"]);
    expect(lines.join("\n")).toContain("checkout");
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

  it("нет записи — ok:false без throw", async () => {
    const errors: string[] = [];
    const result = await runRm({
      slug: "gone",
      removeShare: async () => ({ ok: false, detail: "шара «gone» не найдена" }),
      error: (line) => errors.push(line),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.detail).toContain("gone");
    expect(errors.join("\n")).toMatch(/пропуск/);
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
