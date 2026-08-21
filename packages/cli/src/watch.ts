import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  CHROMIUM_INSTALL_HINT,
  isMissingChromiumError,
  type CaptureInput,
  type CaptureShot,
} from "@protoshare/capture";
import {
  toShareSlug,
  type DetectedTarget,
  type WriteGalleryInput,
} from "@protoshare/core";
import type {
  ShareServer,
  SidecarShareBusy,
  SidecarShareRequest,
  SidecarShareResponse,
} from "@protoshare/share-app";

export type WatchLiveResult =
  | { ok: true; url: string; stop: () => Promise<void> }
  | { ok: false; detail?: string };

export type WatchDeps = {
  outDir: string;
  galleryPort: number;
  detectTarget: (origin: string) => Promise<DetectedTarget>;
  captureTarget: (input: CaptureInput) => Promise<CaptureShot[]>;
  writeGallery: (input: WriteGalleryInput) => Promise<{ slug: string; outDir: string }>;
  startShareServer: (opts: { root: string; port: number }) => Promise<ShareServer>;
  live?: boolean;
  tryZrokShare?: (opts: {
    localOrigin: string;
    uniqueName?: string;
  }) => Promise<WatchLiveResult>;
  uniqueName?: (slug: string) => string | undefined;
  recordShare?: (input: {
    slug: string;
    title: string;
    origin: string;
    url?: string;
  }) => Promise<{ ok: boolean; detail?: string }>;
  error?: (line: string) => void;
};

export function createWatchHandler(deps: WatchDeps): {
  onShare: (
    req: SidecarShareRequest,
  ) => Promise<SidecarShareResponse | SidecarShareBusy>;
  stop: () => Promise<void>;
} {
  let gallery: ShareServer | undefined;
  let stopLive: (() => Promise<void>) | undefined;
  let inflight = false;

  const tearDown = async () => {
    await stopLive?.();
    stopLive = undefined;
    await gallery?.stop();
    gallery = undefined;
  };

  return {
    async onShare(req) {
      if (inflight) return { error: "share-in-progress" };
      inflight = true;
      try {
        const target = await deps.detectTarget(req.origin);
        const title = req.title?.trim() || target.title || target.kind;
        const slug = toShareSlug(title);
        const outDir = join(deps.outDir, slug);
        await mkdir(outDir, { recursive: true });
        let shots: CaptureShot[];
        try {
          shots = await deps.captureTarget({
            kind: target.kind,
            origin: target.origin,
            stories: target.stories,
            storyId: req.storyId,
            outDir,
          });
        } catch (err) {
          if (isMissingChromiumError(err)) {
            (deps.error ?? console.error)(CHROMIUM_INSTALL_HINT);
          }
          throw err;
        }
        const captured = shots.length;
        const total = target.kind === "storybook" ? target.stories.length : 1;
        await deps.writeGallery({
          outDir,
          title,
          origin: target.origin,
          shots,
          slug,
          captured,
          total,
        });
        await tearDown();
        gallery = await deps.startShareServer({
          root: outDir,
          port: deps.galleryPort,
        });
        let url = gallery.origin;
        if (deps.live !== false && deps.tryZrokShare) {
          const live = await deps.tryZrokShare({
            localOrigin: gallery.origin,
            uniqueName: deps.uniqueName?.(slug),
          });
          if (live.ok) {
            stopLive = live.stop;
            url = live.url;
          }
        }
        try {
          await deps.recordShare?.({
            slug,
            title,
            origin: target.origin,
            url,
          });
        } catch {
          // каталог не должен ронять шар
        }
        return { url, captured, total };
      } finally {
        inflight = false;
      }
    },
    stop: tearDown,
  };
}
