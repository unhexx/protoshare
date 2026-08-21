import type { StoryRef } from "@protoshare/core";
import { MAX_STORIES } from "./budget.ts";

export function selectStories(
  stories: StoryRef[],
  opts: { preferId?: string; max?: number } = {},
): { selected: StoryRef[]; total: number; truncated: boolean } {
  const max = opts.max ?? MAX_STORIES;
  const total = stories.length;
  const preferred = opts.preferId
    ? stories.find((story) => story.id === opts.preferId)
    : undefined;
  const rest = preferred
    ? stories.filter((story) => story.id !== preferred.id)
    : stories;
  const ordered = preferred ? [preferred, ...rest] : rest;
  const selected = ordered.slice(0, max);
  return {
    selected,
    total,
    truncated: selected.length < total,
  };
}
