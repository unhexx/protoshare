import { describe, expect, it } from "vitest";
import { overlayClientSource } from "./script.ts";

describe("overlayClientSource", () => {
  it("рисует кнопку Share и бьёт в /v1/share", () => {
    const src = overlayClientSource();
    expect(src).toContain('data-protoshare="share"');
    expect(src).toContain("http://127.0.0.1:4178/v1/share");
    expect(src).toContain("npx protoshare");
    expect(src).toContain("protoshare-overlay");
  });

  it("подставляет свой сайдкар", () => {
    const src = overlayClientSource({ sidecarOrigin: "http://127.0.0.1:9999" });
    expect(src).toContain("http://127.0.0.1:9999/v1/share");
  });
});
