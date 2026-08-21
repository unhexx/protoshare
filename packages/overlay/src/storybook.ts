import { overlayClientSource, type OverlayClientOpts } from "./script.ts";

export function previewHead(head = "", opts: OverlayClientOpts = {}): string {
  return `${head}\n<script>${overlayClientSource(opts)}</script>\n`;
}

const preset = { previewHead };
export default preset;
