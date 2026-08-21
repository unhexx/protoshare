import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type Browser, type LaunchOptions } from "playwright";
import type { PreviewKind, StoryRef } from "@protoshare/core";

export type CaptureShot = {
  id: string;
  title: string;
  file: string;
};

export type CaptureInput = {
  kind: PreviewKind;
  origin: string;
  stories: StoryRef[];
  outDir: string;
};

export type CaptureDeps = {
  launch?: (options?: LaunchOptions) => Promise<Browser>;
};

/** Playwright не качает браузер на npm install. Команда для опубликованного `protoshare`, не workspace capture. */
export const CHROMIUM_INSTALL_HINT =
  "npx --package=protoshare playwright install chromium";

export class MissingChromiumError extends Error {
  readonly hint = CHROMIUM_INSTALL_HINT;
  constructor(cause?: unknown) {
    super(CHROMIUM_INSTALL_HINT);
    this.name = "MissingChromiumError";
    if (cause !== undefined) this.cause = cause;
  }
}

function errorText(err: unknown): string {
  if (err instanceof Error) return `${err.name}\n${err.message}\n${err.stack ?? ""}`;
  return String(err);
}

export function isMissingChromiumError(err: unknown): boolean {
  if (err instanceof MissingChromiumError) return true;
  const text = errorText(err);
  return /executable doesn['’]?t exist/i.test(text) || /browserNotInstalled/i.test(text);
}

function fileName(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]+/g, "_") + ".png";
}

async function launchChromium(deps: CaptureDeps = {}): Promise<Browser> {
  const launch = deps.launch ?? ((options?: LaunchOptions) => chromium.launch(options));
  try {
    return await launch({
      // Arch/нестандартные sandbox'ы часто ломают bundled chromium.
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
  } catch (err) {
    if (isMissingChromiumError(err)) throw new MissingChromiumError(err);
    throw err;
  }
}

export async function captureTarget(
  input: CaptureInput,
  deps: CaptureDeps = {},
): Promise<CaptureShot[]> {
  const shotsDir = join(input.outDir, "shots-raw");
  await mkdir(shotsDir, { recursive: true });

  const browser = await launchChromium(deps);
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const shots: CaptureShot[] = [];

    if (input.kind === "storybook" && input.stories.length > 0) {
      for (const story of input.stories) {
        const url = `${input.origin}/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`;
        await page.goto(url, { waitUntil: "networkidle", timeout: 15_000 });
        const file = join(shotsDir, fileName(story.id));
        await page.screenshot({ path: file, fullPage: true });
        shots.push({
          id: story.id,
          title: `${story.title} / ${story.name}`,
          file,
        });
      }
      return shots;
    }

    await page.goto(input.origin, { waitUntil: "networkidle", timeout: 15_000 });
    const file = join(shotsDir, "preview.png");
    await page.screenshot({ path: file, fullPage: true });
    shots.push({ id: "preview", title: "Preview", file });
    return shots;
  } finally {
    await browser.close();
  }
}
