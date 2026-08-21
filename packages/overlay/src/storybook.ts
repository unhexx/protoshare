import { MANAGER_ENTRY } from "./manager.ts";
import { overlayClientSource, type OverlayClientOpts } from "./script.ts";

export function previewHead(head = "", opts: OverlayClientOpts = {}): string {
  return `${head}\n<script>${overlayClientSource(opts)}</script>\n`;
}

export function managerEntries(existing: string[] = []): string[] {
  return [...existing, MANAGER_ENTRY];
}

const preset = { previewHead, managerEntries };
export default preset;
