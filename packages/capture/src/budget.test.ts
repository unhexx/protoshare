import { describe, expect, it } from "vitest";
import {
  DEFAULT_SHARE_TIMEOUT_MS,
  LAUNCH_AND_GALLERY_MS,
  LIVE_BUDGET_MS,
  MAX_STORIES,
  STORY_GOTO_TIMEOUT_MS,
  STORY_READY_SELECTOR,
  STORY_SETTLE_MS,
  STORY_WAIT_UNTIL,
} from "./budget.ts";

describe("share budget", () => {
  it("overlay timeout покрывает cap историй, live и запуск", () => {
    expect(DEFAULT_SHARE_TIMEOUT_MS).toBeGreaterThan(
      MAX_STORIES * (STORY_GOTO_TIMEOUT_MS + STORY_SETTLE_MS) +
        LIVE_BUDGET_MS +
        LAUNCH_AND_GALLERY_MS,
    );
  });

  it("селектор ждет ребенка #storybook-root, не пустой root и не data-is-storybook", () => {
    expect(STORY_WAIT_UNTIL).toBe("domcontentloaded");
    expect(STORY_READY_SELECTOR).toBe("#storybook-root > *");
    expect(STORY_READY_SELECTOR).not.toBe("#storybook-root");
    expect(STORY_READY_SELECTOR).not.toContain("data-is-storybook");
    expect(MAX_STORIES).toBe(12);
    expect(STORY_GOTO_TIMEOUT_MS).toBe(5_000);
    expect(STORY_SETTLE_MS).toBe(400);
    expect(LIVE_BUDGET_MS).toBe(24_000);
    expect(LAUNCH_AND_GALLERY_MS).toBe(15_000);
    expect(DEFAULT_SHARE_TIMEOUT_MS).toBe(120_000);
  });
});
