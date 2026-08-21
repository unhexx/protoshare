import { injectOverlay, OVERLAY_SCRIPT_SRC } from "./inject.ts";
import { overlayClientSource, type OverlayClientOpts } from "./script.ts";

export type OverlayMiddleware = (
  req: { url?: string },
  res: { setHeader: (k: string, v: string) => void; end: (body: string) => void },
  next: () => void,
) => void;

export type OverlayViteServer = {
  middlewares: { use: (fn: OverlayMiddleware) => void };
};

export function protoshareOverlay(opts: OverlayClientOpts = {}) {
  const source = overlayClientSource(opts);
  return {
    name: "protoshare-overlay",
    apply: "serve" as const,
    transformIndexHtml(html: string): string {
      return injectOverlay(html, OVERLAY_SCRIPT_SRC);
    },
    configureServer(server: OverlayViteServer): void {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? "").split("?")[0];
        if (path !== OVERLAY_SCRIPT_SRC) {
          next();
          return;
        }
        res.setHeader("content-type", "application/javascript; charset=utf-8");
        res.end(source);
      });
    },
  };
}
