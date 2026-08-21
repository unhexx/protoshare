import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium, type Browser, type LaunchOptions, type Page } from "playwright";
import type { PreviewKind, StoryRef } from "@protoshare/core";
import {
  STORY_GOTO_TIMEOUT_MS,
  STORY_READY_SELECTOR,
  STORY_SETTLE_MS,
  STORY_WAIT_UNTIL,
} from "./budget.ts";
import { selectStories } from "./select-stories.ts";

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
  storyId?: string;
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

export function isMissingChromiumError(err: unknown): boolean {
  if (err instanceof MissingChromiumError) return true;
  if (err instanceof Error) {
    if (err.name === "browserNotInstalled") return true;
    return /executable doesn['’]?t exist/i.test(err.message);
  }
  return /executable doesn['’]?t exist/i.test(String(err));
}

function fileName(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]+/g, "_") + ".png";
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, STORY_SETTLE_MS));
}

/** Положительный timeout для waitFor; иначе null — 0 в Playwright значит «без лимита». */
export function storyReadyTimeoutMs(elapsedMs: number): number | null {
  const timeout = STORY_GOTO_TIMEOUT_MS - elapsedMs - STORY_SETTLE_MS;
  return timeout > 0 ? timeout : null;
}

async function gotoStorybook(page: Page, url: string): Promise<void> {
  const started = Date.now();
  try {
    await page.goto(url, {
      waitUntil: STORY_WAIT_UNTIL,
      timeout: STORY_GOTO_TIMEOUT_MS,
    });
  } catch {
    // DCL одной истории не рвёт остальные
  }
  const timeout = storyReadyTimeoutMs(Date.now() - started);
  if (timeout !== null) {
    try {
      await page.locator(STORY_READY_SELECTOR).first().waitFor({
        state: "visible",
        timeout,
      });
    } catch {
      // пустой canvas всё равно снимаем
    }
  }
  await settle();
}

async function gotoPreview(page: Page, url: string): Promise<void> {
  await page.goto(url, {
    waitUntil: STORY_WAIT_UNTIL,
    timeout: STORY_GOTO_TIMEOUT_MS,
  });
  await settle();
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
  const { selected } = selectStories(input.stories, { preferId: input.storyId });

  const browser = await launchChromium(deps);
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const shots: CaptureShot[] = [];

    if (input.kind === "storybook" && selected.length > 0) {
      for (const story of selected) {
        const url = `${input.origin}/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`;
        await gotoStorybook(page, url);
        const file = join(shotsDir, fileName(story.id));
        try {
          await page.screenshot({
            path: file,
            fullPage: true,
            timeout: STORY_GOTO_TIMEOUT_MS,
          });
          shots.push({
            id: story.id,
            title: `${story.title} / ${story.name}`,
            file,
          });
        } catch {
          // даже скрин не вышел — идём дальше
        }
      }
      return shots;
    }

    await gotoPreview(page, input.origin);
    const file = join(shotsDir, "preview.png");
    await page.screenshot({ path: file, fullPage: true });
    shots.push({ id: "preview", title: "Preview", file });
    return shots;
  } finally {
    await browser.close();
  }
}
