#!/usr/bin/env npx tsx
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { defineCommand, runMain } from "citty";
import { captureTarget } from "@protoshare/capture";
import {
  detectTarget,
  scanLocalPreviews,
  toShareSlug,
  packGallery,
  uploadArchive,
  writeGallery,
} from "@protoshare/core";
import { toZrokUniqueName, tryLiveShare } from "@protoshare/live";
import { startShareServer, startSidecar } from "@protoshare/share-app";
import { createWatchHandler } from "./watch.ts";

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
      description: "Try a public zrok/cloudflared URL (falls back to the local gallery)",
      default: true,
    },
    slug: {
      type: "string",
      description: "Vanity share name (default: from the preview title)",
    },
    port: { type: "string", description: "Gallery bind port (0 = ephemeral)", default: "4177" },
    watch: {
      type: "boolean",
      description: "Overlay sidecar: POST /v1/share on :4178",
      default: false,
    },
    sidecarPort: {
      type: "string",
      description: "Sidecar bind port",
      default: "4178",
    },
    pack: {
      type: "boolean",
      description: "Write a .tgz archive of the gallery",
      default: false,
    },
    uploadUrl: {
      type: "string",
      description: "PUT gallery.tgz to a presigned S3/R2 URL",
    },
    publicUrl: {
      type: "string",
      description: "Public URL to print after upload",
    },
  },
  async run({ args }) {
    if (args.watch) {
      await runWatch(args);
      return;
    }

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
    const uploadUrl =
      (typeof args.uploadUrl === "string" && args.uploadUrl.trim()) ||
      process.env.PROTOSHARE_UPLOAD_URL ||
      "";
    if (args.pack || uploadUrl) {
      const archive = await packGallery(outDir);
      console.log(`Pack:    ${archive}`);
      if (uploadUrl) {
        const remote = await uploadArchive({
          file: archive,
          putUrl: uploadUrl,
          publicUrl:
            (typeof args.publicUrl === "string" && args.publicUrl.trim()) ||
            process.env.PROTOSHARE_PUBLIC_URL,
        });
        if (remote.ok) console.log(`Remote:  ${remote.url}`);
        else console.log(`Remote:  пропуск (${remote.detail})`);
      }
    }
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
      const live = await tryLiveShare({
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

async function runWatch(args: {
  out: unknown;
  port: unknown;
  sidecarPort: unknown;
  live: unknown;
}) {
  const galleryPort = Number(args.port);
  const sidecarPort = Number(args.sidecarPort);
  const handler = createWatchHandler({
    outDir: join(process.cwd(), String(args.out)),
    galleryPort: Number.isFinite(galleryPort) ? galleryPort : 4177,
    detectTarget,
    captureTarget,
    writeGallery,
    startShareServer,
    live: args.live !== false,
    tryZrokShare: tryLiveShare,
    uniqueName: toZrokUniqueName,
  });
  const sidecar = await startSidecar({
    port: Number.isFinite(sidecarPort) ? sidecarPort : 4178,
    onShare: handler.onShare,
  });
  console.log(`Watch:   ${sidecar.origin}`);
  console.log(`Share:   POST ${sidecar.origin}/v1/share`);
  console.log("Ctrl+C чтобы остановить.");
  await new Promise<void>((resolve) => {
    process.on("SIGINT", () => resolve());
    process.on("SIGTERM", () => resolve());
  });
  await handler.stop();
  await sidecar.stop();
}
