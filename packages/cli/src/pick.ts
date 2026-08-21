import type { DetectedTarget } from "@protoshare/core";

export type SelectOption = { value: string; label: string };

export type SelectFn = (input: {
  message: string;
  options: SelectOption[];
}) => Promise<unknown>;

export function formatPreviewLabel(target: DetectedTarget): string {
  const title = target.title?.trim();
  return title
    ? `${target.kind}  ${target.origin}  ${title}`
    : `${target.kind}  ${target.origin}`;
}

async function defaultSelect(input: {
  message: string;
  options: SelectOption[];
}): Promise<unknown> {
  const { select } = await import("@clack/prompts");
  return select({
    message: input.message,
    options: input.options,
  });
}

function defaultIsCancel(value: unknown): boolean {
  return typeof value === "symbol";
}

/** 0 → null, 1 → без вопроса, иначе clack select. */
export async function pickPreview(
  targets: DetectedTarget[],
  opts: {
    select?: SelectFn;
    isCancel?: (value: unknown) => boolean;
  } = {},
): Promise<DetectedTarget | null> {
  if (targets.length === 0) return null;
  if (targets.length === 1) return targets[0]!;
  const value = await (opts.select ?? defaultSelect)({
    message: "Несколько превью. Какое шарить?",
    options: targets.map((target) => ({
      value: target.origin,
      label: formatPreviewLabel(target),
    })),
  });
  const isCancel = opts.isCancel ?? defaultIsCancel;
  if (isCancel(value) || typeof value !== "string") return null;
  return targets.find((target) => target.origin === value) ?? null;
}
