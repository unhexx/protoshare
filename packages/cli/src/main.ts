import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { defineCommand, runMain } from "citty";
import {
  captureTarget,
  CHROMIUM_INSTALL_HINT,
  isMissingChromiumError,
  type CaptureShot,
} from "@protoshare/capture";
import {
  detectTarget,
  scanAllLocalPreviews,
  toShareSlug,
  packGallery,
  recordShare,
  s3ConfigFromEnv,
  s3ObjectKey,
  uploadArchive,
  uploadArchiveS3,
  writeGallery,
} from "@protoshare/core";
import { toZrokUniqueName, tryLiveShare } from "@protoshare/live";
import { startShareServer, startSidecar, type ShareServer } from "@protoshare/share-app";
import { openInBrowser } from "./browser.ts";
import { copyToClipboard } from "./clipboard.ts";
import { renderShareQr } from "./qr.ts";
import { runList } from "./list.ts";
import { runOpen } from "./open.ts";
import { pickPreview } from "./pick.ts";
import { runRm } from "./rm.ts";
import { persistShare } from "./share-url.ts";
import { createWatchHandler } from "./watch.ts";

const listCommand = defineCommand({
  meta: {
    name: "list",
    description: "Show recorded shares from the libsql catalog",
  },
  args: {
    limit: { type: "string", description: "Max rows", default: "20" },
    json: { type: "boolean", description: "Print catalog as JSON", default: false },
    out: { type: "string", description: "Gallery output directory", default: ".protoshare/out" },
  },
  async run({ args }) {
    const limit = Number(args.limit);
    const result = await runList({
      limit: Number.isFinite(limit) && limit > 0 ? limit : 20,
      json: args.json === true,
      outDir: typeof args.out === "string" ? args.out : ".protoshare/out",
    });
    if (!result.ok) process.exitCode = 1;
  },
});

const rmCommand = defineCommand({
  meta: {
    name: "rm",
    description: "Remove a share from the catalog and its gallery files",
  },
  args: {
    slug: { type: "positional", description: "Share slug to remove", required: true },
    out: { type: "string", description: "Gallery output directory", default: ".protoshare/out" },
    files: {
      type: "boolean",
      description: "Also delete .protoshare/out/<slug>",
      default: true,
    },
  },
  async run({ args }) {
    const result = await runRm({
      slug: typeof args.slug === "string" ? args.slug : "",
      outDir: typeof args.out === "string" ? args.out : ".protoshare/out",
      files: args.files !== false,
    });
    if (!result.ok) process.exitCode = 1;
  },
});

const openCommand = defineCommand({
  meta: {
    name: "open",
    description: "Serve a saved snapshot gallery by slug",
  },
  args: {
    slug: { type: "positional", description: "Share slug to open", required: true },
    out: { type: "string", description: "Gallery output directory", default: ".protoshare/out" },
    port: { type: "string", description: "Gallery bind port (0 = ephemeral)", default: "4177" },
    copy: {
      type: "boolean",
      description: "Copy the gallery URL to the clipboard",
      default: true,
    },
    browser: {
      type: "boolean",
      description: "Open the gallery URL in the default browser",
      default: true,
    },
    qr: {
      type: "boolean",
      description: "Print a terminal QR of the gallery URL",
      default: true,
    },
    live: {
      type: "boolean",
      description: "Try a public zrok/cloudflared URL (falls back to the local gallery)",
      default: true,
    },
  },
  async run({ args }) {
    const port = Number(args.port);
    const result = await runOpen({
      slug: typeof args.slug === "string" ? args.slug : "",
      outDir: typeof args.out === "string" ? args.out : ".protoshare/out",
      port: Number.isFinite(port) ? port : 4177,
      live: args.live !== false,
    });
    if (!result.ok) {
      process.exitCode = 1;
      return;
    }
    await noteShareUrl(result.origin, args);
    console.log("Ctrl+C чтобы остановить.");
    await new Promise<void>((resolve) => {
      process.on("SIGINT", () => resolve());
      process.on("SIGTERM", () => resolve());
    });
    await result.stop();
  },
});

const main = defineCommand({
  meta: {
    name: "protoshare",
    // citty без footer — команда Chromium в description, видна в --help.
    description: `Share local Storybook/Vite/Next prototypes as a snapshot gallery. Missing Chromium: ${CHROMIUM_INSTALL_HINT}`,
  },
  subCommands: {
    list: listCommand,
    rm: rmCommand,
    open: openCommand,
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
    copy: {
      type: "boolean",
      description: "Copy the gallery/live URL to the clipboard",
      default: true,
    },
    browser: {
      type: "boolean",
      description: "Open the share URL in the default browser",
      default: true,
    },
    qr: {
      type: "boolean",
      description: "Print a terminal QR of the share URL",
      default: true,
    },
  },
  async run({ args }) {
    if (args.watch) {
      await runWatch(args);
      return;
    }

    const origin = typeof args.url === "string" && args.url.length > 0 ? args.url : null;
    let target;
    if (origin) {
      target = await detectTarget(origin);
    } else {
      const found = await scanAllLocalPreviews();
      if (found.length === 0) {
        console.error("Не нашёл локальный превьюер. Запусти Storybook/Vite или передай URL.");
        process.exitCode = 1;
        return;
      }
      target = await pickPreview(found);
      if (!target) {
        process.exitCode = 1;
        return;
      }
    }

    console.log(`Цель: ${target.kind} ${target.origin}`);
    const title = target.title ?? target.kind;
    const slug = toShareSlug(
      typeof args.slug === "string" && args.slug.trim().length > 0 ? args.slug : title,
    );
    const outDir = join(process.cwd(), String(args.out), slug);
    await mkdir(outDir, { recursive: true });

    let shots: CaptureShot[];
    try {
      shots = await captureTarget({
        kind: target.kind,
        origin: target.origin,
        stories: target.stories,
        outDir,
      });
    } catch (err) {
      if (isMissingChromiumError(err)) {
        console.error(CHROMIUM_INSTALL_HINT);
        process.exitCode = 1;
        return;
      }
      throw err;
    }
    await writeGallery({ outDir, title, origin: target.origin, shots, slug });

    console.log(`Share:   ${slug}`);
    console.log(`Files:   ${outDir}`);
    const uploadUrl =
      (typeof args.uploadUrl === "string" && args.uploadUrl.trim()) ||
      process.env.PROTOSHARE_UPLOAD_URL ||
      "";
    const s3 = s3ConfigFromEnv();
    let remoteUrl =
      (typeof args.publicUrl === "string" && args.publicUrl.trim()) ||
      process.env.PROTOSHARE_PUBLIC_URL ||
      "";
    if (args.pack || uploadUrl || s3) {
      const archive = await packGallery(outDir);
      console.log(`Pack:    ${archive}`);
      if (uploadUrl) {
        const remote = await uploadArchive({
          file: archive,
          putUrl: uploadUrl,
          publicUrl: remoteUrl,
        });
        if (remote.ok) {
          console.log(`Remote:  ${remote.url}`);
          remoteUrl = remote.url;
        } else console.log(`Remote:  пропуск (${remote.detail})`);
      } else if (s3) {
        const remote = await uploadArchiveS3({
          file: archive,
          config: s3,
          key: s3ObjectKey(s3.prefix, slug),
          publicUrl: remoteUrl,
        });
        if (remote.ok) {
          console.log(`Remote:  ${remote.url}`);
          remoteUrl = remote.url;
        } else console.log(`Remote:  пропуск (${remote.detail})`);
      }
    }
    const remote = remoteUrl || undefined;
    if (args.open === false) {
      const persisted = await persistShare({
        slug,
        title,
        origin: target.origin,
        remote,
      });
      noteCatalog(persisted.catalog);
      if (persisted.sessionUrl) await noteShareUrl(persisted.sessionUrl, args);
      return;
    }

    const galleryPort = Number(args.port);
    let server: ShareServer;
    try {
      server = await startShareServer({
        root: outDir,
        port: Number.isFinite(galleryPort) ? galleryPort : 4177,
      });
    } catch (err) {
      // pack/upload уже прошёл — remote не должен пропасть из-за EADDRINUSE
      const persisted = await persistShare({
        slug,
        title,
        origin: target.origin,
        remote,
      });
      noteCatalog(persisted.catalog);
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`Gallery: пропуск (${detail})`);
      process.exitCode = 1;
      return;
    }
    console.log(`Gallery: ${server.origin}`);

    let stopLive: (() => Promise<void>) | undefined;
    let liveUrl: string | undefined;
    if (args.live !== false) {
      try {
        const live = await tryLiveShare({
          localOrigin: server.origin,
          uniqueName: toZrokUniqueName(slug),
        });
        if (live.ok) {
          console.log(`Live:    ${live.provider} ${live.url}`);
          stopLive = live.stop;
          liveUrl = live.url;
        } else {
          console.log(`Live:    пропуск (${live.detail})`);
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        console.log(`Live:    пропуск (${detail})`);
      }
    }

    try {
      const persisted = await persistShare({
        slug,
        title,
        origin: target.origin,
        live: liveUrl,
        remote,
        gallery: server.origin,
      });
      noteCatalog(persisted.catalog);
      await noteShareUrl(persisted.sessionUrl ?? server.origin, args);

      console.log("Ctrl+C чтобы остановить.");
      await new Promise<void>((resolve) => {
        process.on("SIGINT", () => resolve());
        process.on("SIGTERM", () => resolve());
      });
    } finally {
      await stopLive?.();
      await server.stop();
    }
  },
});

await runMain(main);

function noteCatalog(catalog: { ok: true; share: { slug: string } } | { ok: false; detail: string }): void {
  if (catalog.ok) console.log(`Catalog: ${catalog.share.slug}`);
  else console.log(`Catalog: пропуск (${catalog.detail})`);
}

async function noteShareUrl(
  url: string,
  args: { copy?: unknown; browser?: unknown; qr?: unknown },
): Promise<void> {
  if (args.copy !== false) {
    const copied = await copyToClipboard(url);
    if (copied.ok) console.log("Clipboard: URL");
    else console.log(`Clipboard: пропуск (${copied.detail})`);
  }
  if (args.browser !== false) {
    const opened = await openInBrowser(url);
    if (opened.ok) console.log("Browser:  URL");
    else console.log(`Browser:  пропуск (${opened.detail})`);
  }
  if (args.qr !== false) {
    const qr = renderShareQr(url);
    if (qr.ok) {
      console.log(qr.text);
      console.log("QR:      URL");
    } else console.log(`QR:      пропуск (${qr.detail})`);
  }
}

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
    recordShare,
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
