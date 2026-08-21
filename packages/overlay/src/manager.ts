import { requestShare } from "./share.ts";

export const ADDON_ID = "protoshare";
export const TOOL_ID = "protoshare/tool";
export const MANAGER_ENTRY = "@protoshare/overlay/manager";

export type AddonsApi = {
  register: (id: string, callback: () => void) => void;
  add: (id: string, descriptor: Record<string, unknown>) => void;
};

export type ShareToolHost = {
  createElement: (
    type: string,
    props: Record<string, unknown> | null,
    ...children: unknown[]
  ) => unknown;
  getOrigin: () => string;
  getTitle?: () => string | undefined;
  sidecarOrigin?: string;
  fetchImpl?: typeof fetch;
  clipboardWrite?: (text: string) => Promise<void>;
  onStatus?: (text: string) => void;
};

export async function onShareClick(opts: {
  origin: string;
  title?: string;
  sidecarOrigin?: string;
  fetchImpl?: typeof fetch;
  clipboardWrite?: (text: string) => Promise<void>;
}): Promise<{ text: string; copied: boolean }> {
  const result = await requestShare({
    origin: opts.origin,
    title: opts.title,
    sidecarOrigin: opts.sidecarOrigin,
    fetchImpl: opts.fetchImpl,
  });
  const text = result.ok ? result.url : result.command;
  if (!opts.clipboardWrite) return { text, copied: false };
  try {
    await opts.clipboardWrite(text);
    return { text, copied: true };
  } catch {
    return { text, copied: false };
  }
}

export function createShareButtonRender(host: ShareToolHost): () => unknown {
  return function ProtoshareShareTool() {
    return host.createElement(
      "button",
      {
        type: "button",
        title: "Share with protoshare",
        "data-protoshare": "manager-share",
        onClick: () =>
          onShareClick({
            origin: host.getOrigin(),
            title: host.getTitle?.(),
            sidecarOrigin: host.sidecarOrigin,
            fetchImpl: host.fetchImpl,
            clipboardWrite: host.clipboardWrite,
          }).then((out) => {
            host.onStatus?.(out.text);
          }),
      },
      "Share",
    );
  };
}

export function registerShareAddon(
  addons: AddonsApi,
  types: { TOOL: unknown },
  render: () => unknown,
): void {
  addons.register(ADDON_ID, () => {
    addons.add(TOOL_ID, {
      type: types.TOOL,
      title: "protoshare",
      match: (ctx: { viewMode?: string }) =>
        ctx.viewMode === undefined || ctx.viewMode === "story" || ctx.viewMode === "docs",
      render,
    });
  });
}
