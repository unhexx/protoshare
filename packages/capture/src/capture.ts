import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
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

function fileName(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]+/g, "_") + ".png";
}

export async function captureTarget(input: CaptureInput): Promise<CaptureShot[]> {
  const shotsDir = join(input.outDir, "shots-raw");
  await mkdir(shotsDir, { recursive: true });

  const browser = await chromium.launch({
    // Arch/нестандартные sandbox'ы часто ломают bundled chromium.
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
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
