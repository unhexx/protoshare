import { describe, expect, it } from "vitest";
import { MANAGER_ENTRY } from "./manager.ts";
import preset, { managerEntries, previewHead } from "./storybook.ts";

describe("storybook preset", () => {
  it("кладёт overlay в previewHead", () => {
    const head = previewHead("<meta charset='utf-8'>");
    expect(head).toContain("<meta charset='utf-8'>");
    expect(head).toContain("<script>");
    expect(head).toContain("protoshare-overlay");
    expect(head).toContain("/v1/share");
  });

  it("добавляет manager toolbar entry", () => {
    expect(managerEntries(["./other"])).toEqual(["./other", MANAGER_ENTRY]);
    expect(preset.managerEntries).toBe(managerEntries);
  });

  it("экспортирует preset для addons[]", () => {
    expect(preset.previewHead).toBe(previewHead);
  });
});
