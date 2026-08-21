import { overlayClientSource, type OverlayClientOpts } from "./script.ts";

export type OverlayScriptEl = {
  setAttribute: (name: string, value: string) => void;
  textContent: string | null;
  remove?: () => void;
};

export type OverlayDocument = {
  createElement: (tag: string) => OverlayScriptEl;
  documentElement: { appendChild: (el: OverlayScriptEl) => void };
};

export const NEXT_SCRIPT_ID = "protoshare-next-script";

/** Props for `next/script` — injects the same overlay as Vite/Storybook. */
export function protoshareScriptProps(opts: OverlayClientOpts = {}) {
  return {
    id: NEXT_SCRIPT_ID,
    strategy: "afterInteractive" as const,
    dangerouslySetInnerHTML: { __html: overlayClientSource(opts) },
  };
}

/** Mount overlay script into a document (client component / tests). */
export function injectOverlayScript(
  doc: OverlayDocument,
  opts: OverlayClientOpts = {},
): OverlayScriptEl {
  const script = doc.createElement("script");
  script.setAttribute("id", NEXT_SCRIPT_ID);
  script.setAttribute("data-protoshare", "next-script");
  script.textContent = overlayClientSource(opts);
  doc.documentElement.appendChild(script);
  return script;
}
