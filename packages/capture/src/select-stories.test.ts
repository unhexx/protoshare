import { describe, expect, it } from "vitest";
import type { StoryRef } from "@protoshare/core";
import { MAX_STORIES } from "./budget.ts";
import { selectStories } from "./select-stories.ts";

function stories(n: number): StoryRef[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `s-${i}`,
    title: "T",
    name: `N${i}`,
  }));
}

describe("selectStories", () => {
  it("ставит preferId первым и добирает из индекса", () => {
    const all = stories(5);
    const result = selectStories(all, { preferId: "s-3" });
    expect(result.selected.map((s) => s.id)).toEqual([
      "s-3",
      "s-0",
      "s-1",
      "s-2",
      "s-4",
    ]);
    expect(result.total).toBe(5);
    expect(result.truncated).toBe(false);
  });

  it("режет до 12, total не меняется", () => {
    const all = stories(20);
    const result = selectStories(all, { preferId: "s-15" });
    expect(result.selected).toHaveLength(MAX_STORIES);
    expect(result.selected[0]?.id).toBe("s-15");
    expect(result.selected.slice(1).map((s) => s.id)).toEqual(
      stories(11).map((s) => s.id),
    );
    expect(result.total).toBe(20);
    expect(result.truncated).toBe(true);
  });

  it("без preferId берёт первые 12 в порядке индекса", () => {
    const result = selectStories(stories(15));
    expect(result.selected.map((s) => s.id)).toEqual(
      stories(12).map((s) => s.id),
    );
    expect(result.total).toBe(15);
    expect(result.truncated).toBe(true);
  });

  it("незнакомый preferId не меняет порядок", () => {
    const all = stories(3);
    const result = selectStories(all, { preferId: "missing" });
    expect(result.selected.map((s) => s.id)).toEqual(["s-0", "s-1", "s-2"]);
    expect(result.total).toBe(3);
  });
});
