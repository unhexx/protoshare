#!/usr/bin/env npx tsx
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { defineCommand, runMain } from "citty";
import { captureTarget } from "@protoshare/capture";
import {
  detectTarget,
  scanLocalPreviews,
  writeGallery,
} from "@protoshare/core";
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
    const outDir = join(process.cwd(), String(args.out), Date.now().toString(36));
    await mkdir(outDir, { recursive: true });

    const shots = await captureTarget({
      kind: target.kind,
      origin: target.origin,
      stories: target.stories,
      outDir,
    });
    const title = target.title ?? target.kind;
    await writeGallery({ outDir, title, origin: target.origin, shots });

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
    console.log("Ctrl+C чтобы остановить.");
    await new Promise<void>((resolve) => {
      process.on("SIGINT", () => resolve());
      process.on("SIGTERM", () => resolve());
    });
    await server.stop();
  },
});

await runMain(main);
