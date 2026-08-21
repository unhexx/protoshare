import { describe, expect, it } from "vitest";
import { encodeShareQr, renderShareQr } from "./qr.ts";

describe("encodeShareQr", () => {
  it("не http — ok:false", () => {
    expect(encodeShareQr("").ok).toBe(false);
    expect(encodeShareQr("javascript:alert(1)").ok).toBe(false);
    expect(encodeShareQr("file:///tmp/x").ok).toBe(false);
  });

  it("http(s) — квадрат с finder-pattern", () => {
    const result = encodeShareQr("https://checkout.share.zrok.io");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.size).toBeGreaterThanOrEqual(21);
    expect(result.data).toHaveLength(result.size);
    expect(result.data[0]).toHaveLength(result.size);
    expect(finderAt(result.data, 0, 0)).toBe(true);
    expect(finderAt(result.data, result.size - 7, 0)).toBe(true);
    expect(finderAt(result.data, 0, result.size - 7)).toBe(true);
  });
});

describe("renderShareQr", () => {
  it("не http — ok:false без текста", () => {
    const result = renderShareQr("not a url");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.detail).toBe("not-http");
  });

  it("печатает компактный unicode QR", () => {
    const result = renderShareQr("http://127.0.0.1:4177/");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const lines = result.text.trimEnd().split("\n");
    expect(lines.length).toBeGreaterThan(8);
    expect(result.text).toMatch(/[█▀▄]/);
    expect(renderShareQr("http://127.0.0.1:4177/")).toEqual(result);
    expect(renderShareQr("https://live.example/x")).not.toEqual(result);
  });
});

const FINDER = [
  [1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1],
];

function finderAt(data: boolean[][], left: number, top: number): boolean {
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      if (Boolean(data[top + y]?.[left + x]) !== Boolean(FINDER[y][x])) return false;
    }
  }
  return true;
}
