import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { CaptureInput, CaptureShot } from "@protoshare/capture";
import {
  toShareSlug,
  type DetectedTarget,
  type WriteGalleryInput,
} from "@protoshare/core";
import type { ShareServer, SidecarShareRequest } from "@protoshare/share-app";

export type WatchDeps = {
  outDir: string;
  galleryPort: number;
  detectTarget: (origin: string) => Promise<DetectedTarget>;
  captureTarget: (input: CaptureInput) => Promise<CaptureShot[]>;
  writeGallery: (input: WriteGalleryInput) => Promise<{ slug: string; outDir: string }>;
  startShareServer: (opts: { root: string; port: number }) => Promise<ShareServer>;
};

export function createWatchHandler(deps: WatchDeps): {
  onShare: (req: SidecarShareRequest) => Promise<{ url: string }>;
  stop: () => Promise<void>;
} {
  let gallery: ShareServer | undefined;

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
      await gallery?.stop();
      gallery = await deps.startShareServer({
        root: outDir,
        port: deps.galleryPort,
      });
      return { url: gallery.origin };
    },
    async stop() {
      await gallery?.stop();
      gallery = undefined;
    },
  };
}
