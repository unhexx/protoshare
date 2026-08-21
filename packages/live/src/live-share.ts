import { tryCloudflaredShare } from "./cloudflared.ts";
import { tryZrokShare, type LiveShareResult, type TryZrokShareOpts } from "./zrok.ts";

export type TryLiveShareOpts = TryZrokShareOpts & {
  zrokBinaries?: string[];
  cloudflaredBinaries?: string[];
};

/** zrok, иначе cloudflared, иначе локальная gallery. */
export async function tryLiveShare(opts: TryLiveShareOpts): Promise<LiveShareResult> {
  const zrok = await tryZrokShare({
    localOrigin: opts.localOrigin,
    uniqueName: opts.uniqueName,
    timeoutMs: opts.timeoutMs,
    binaries: opts.zrokBinaries ?? opts.binaries,
  });
  if (zrok.ok) return zrok;

  const cloudflared = await tryCloudflaredShare({
    localOrigin: opts.localOrigin,
    timeoutMs: opts.timeoutMs,
    binaries: opts.cloudflaredBinaries,
  });
  if (cloudflared.ok) return cloudflared;

  return {
    ok: false,
    reason: zrok.reason === "missing-binary" ? cloudflared.reason : zrok.reason,
    detail: `${zrok.detail}; ${cloudflared.detail}`,
  };
}
