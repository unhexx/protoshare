import { describe, expect, it } from "vitest";
import preset, { previewHead } from "./storybook.ts";

describe("storybook preset", () => {
  it("кладёт overlay в previewHead", () => {
    const head = previewHead("<meta charset='utf-8'>");
    expect(head).toContain("<meta charset='utf-8'>");
    expect(head).toContain("<script>");
    expect(head).toContain("protoshare-overlay");
    expect(head).toContain("/v1/share");
  });

  it("экспортирует preset для addons[]", () => {
    expect(preset.previewHead).toBe(previewHead);
  });
});
