#!/usr/bin/env npx tsx
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { defineCommand, runMain } from "citty";
import { captureTarget } from "@protoshare/capture";
import {
  detectTarget,
  scanLocalPreviews,
  toShareSlug,
  writeGallery,
} from "@protoshare/core";
import { toZrokUniqueName, tryZrokShare } from "@protoshare/live";
import { startShareServer } from "@protoshare/share-app";

const main = defineCommand({
  meta: {
    name: "protoshare",
    description: "Share local Storybook/Vite/Next prototypes as a snapshot gallery",
  },
  args: {
    url: { type: "positional", description: "Preview origin, e.g. http://127.0.0.1:6006", required: false },
    out: { type: "string", description: "Output directory", default: ".protoshare/out" },
    open: { type: "boolean", description: "Keep the gallery server running", default: true },
    live: {
      type: "boolean",
      description: "Try a public zrok URL (falls back to the local gallery)",
      default: true,
    },
    slug: {
      type: "string",
      description: "Vanity share name (default: from the preview title)",
    },
    port: { type: "string", description: "Gallery bind port (0 = ephemeral)", default: "4177" },
  },
  async run({ args }) {
    const origin = typeof args.url === "string" && args.url.length > 0 ? args.url : null;
    const target = origin ? await detectTarget(origin) : await scanLocalPreviews();
    if (!target) {
      console.error("Не нашёл локальный превьюер. Запусти Storybook/Vite или передай URL.");
      process.exitCode = 1;
      return;
    }

    console.log(`Цель: ${target.kind} ${target.origin}`);
    const title = target.title ?? target.kind;
    const slug = toShareSlug(
      typeof args.slug === "string" && args.slug.trim().length > 0 ? args.slug : title,
    );
    const outDir = join(process.cwd(), String(args.out), slug);
    await mkdir(outDir, { recursive: true });

    const shots = await captureTarget({
      kind: target.kind,
      origin: target.origin,
      stories: target.stories,
      outDir,
    });
    await writeGallery({ outDir, title, origin: target.origin, shots, slug });

    console.log(`Share:   ${slug}`);
    console.log(`Files:   ${outDir}`);
    if (args.open === false) {
      return;
    }

    const galleryPort = Number(args.port);
    const server = await startShareServer({
      root: outDir,
      port: Number.isFinite(galleryPort) ? galleryPort : 4177,
    });
    console.log(`Gallery: ${server.origin}`);

    let stopLive: (() => Promise<void>) | undefined;
    if (args.live !== false) {
      const live = await tryZrokShare({
        localOrigin: server.origin,
        uniqueName: toZrokUniqueName(slug),
      });
      if (live.ok) {
        console.log(`Live:    ${live.url}`);
        stopLive = live.stop;
      } else {
        console.log(`Live:    пропуск (${live.detail})`);
      }
    }

    console.log("Ctrl+C чтобы остановить.");
    await new Promise<void>((resolve) => {
      process.on("SIGINT", () => resolve());
      process.on("SIGTERM", () => resolve());
    });
    await stopLive?.();
    await server.stop();
  },
});

await runMain(main);
