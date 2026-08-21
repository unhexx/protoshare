import { describe, expect, it } from "vitest";
import type { DetectedTarget } from "@protoshare/core";
import { formatPreviewLabel, pickPreview } from "./pick.ts";

const vite: DetectedTarget = {
  kind: "vite",
  origin: "http://127.0.0.1:5173",
  title: "Vite",
  stories: [],
};
const story: DetectedTarget = {
  kind: "storybook",
  origin: "http://127.0.0.1:6006",
  title: "Button",
  stories: [{ id: "button--primary", title: "Button", name: "Primary" }],
};

describe("formatPreviewLabel", () => {
  it("kind + origin + title", () => {
    expect(formatPreviewLabel(vite)).toBe("vite  http://127.0.0.1:5173  Vite");
  });
});

describe("pickPreview", () => {
  it("пусто — null, select не зовём", async () => {
    let called = 0;
    await expect(
      pickPreview([], {
        select: async () => {
          called += 1;
          return "";
        },
      }),
    ).resolves.toBeNull();
    expect(called).toBe(0);
  });

  it("один превью — сразу его", async () => {
    let called = 0;
    await expect(
      pickPreview([vite], {
        select: async () => {
          called += 1;
          return vite.origin;
        },
      }),
    ).resolves.toEqual(vite);
    expect(called).toBe(0);
  });

  it("несколько — спрашивает select", async () => {
    const picked = await pickPreview([vite, story], {
      select: async (input) => {
        expect(input.options.map((o) => o.value).sort()).toEqual(
          [story.origin, vite.origin].sort(),
        );
        return story.origin;
      },
    });
    expect(picked).toEqual(story);
  });

  it("отмена select — null", async () => {
    const cancel = Symbol("cancel");
    await expect(
      pickPreview([vite, story], {
        select: async () => cancel,
        isCancel: (value) => value === cancel,
      }),
    ).resolves.toBeNull();
  });
});
