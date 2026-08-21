import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { CaptureInput, CaptureShot } from "@protoshare/capture";
import {
  toShareSlug,
  type DetectedTarget,
  type WriteGalleryInput,
} from "@protoshare/core";
import type { ShareServer, SidecarShareRequest } from "@protoshare/share-app";

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
};

export function createWatchHandler(deps: WatchDeps): {
  onShare: (req: SidecarShareRequest) => Promise<{ url: string }>;
  stop: () => Promise<void>;
} {
  let gallery: ShareServer | undefined;
  let stopLive: (() => Promise<void>) | undefined;

  const tearDown = async () => {
    await stopLive?.();
    stopLive = undefined;
    await gallery?.stop();
    gallery = undefined;
  };

  return {
    async onShare(req) {
      const target = await deps.detectTarget(req.origin);
      const title = req.title?.trim() || target.title || target.kind;
      const slug = toShareSlug(title);
      const outDir = join(deps.outDir, slug);
      await mkdir(outDir, { recursive: true });
      const shots = await deps.captureTarget({
        kind: target.kind,
        origin: target.origin,
        stories: target.stories,
        outDir,
      });
      await deps.writeGallery({
        outDir,
        title,
        origin: target.origin,
        shots,
        slug,
      });
      await tearDown();
      gallery = await deps.startShareServer({
        root: outDir,
        port: deps.galleryPort,
      });
      if (deps.live !== false && deps.tryZrokShare) {
        const live = await deps.tryZrokShare({
          localOrigin: gallery.origin,
          uniqueName: deps.uniqueName?.(slug),
        });
        if (live.ok) {
          stopLive = live.stop;
          return { url: live.url };
        }
      }
      return { url: gallery.origin };
    },
    stop: tearDown,
  };
}
