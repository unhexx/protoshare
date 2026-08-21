"use client";

import { useEffect } from "react";
import { injectOverlayScript } from "./next.ts";
import type { OverlayClientOpts } from "./script.ts";

/** Клиентский компонент для `app/layout.tsx`. */
export function ProtoshareOverlay(props: OverlayClientOpts = {}) {
  useEffect(() => {
    const script = injectOverlayScript(document as unknown as Parameters<typeof injectOverlayScript>[0], props);
    return () => {
      script.remove?.();
    };
  }, []);
  return null;
}

export {
  injectOverlayScript,
  NEXT_SCRIPT_ID,
  protoshareScriptProps,
} from "./next.ts";
export type { OverlayClientOpts } from "./script.ts";
