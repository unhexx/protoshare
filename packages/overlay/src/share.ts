export const DEFAULT_SIDECAR = "http://127.0.0.1:4178";

export type ShareOk = {
  ok: true;
  url: string;
};

export type ShareFallback = {
  ok: false;
  command: string;
  reason: "sidecar-down" | "bad-response";
};

export type ShareResult = ShareOk | ShareFallback;

export function shareCommand(origin: string): string {
  return `npx protoshare ${origin}`;
}

export function shareEndpoint(sidecarOrigin: string = DEFAULT_SIDECAR): string {
  return `${sidecarOrigin.replace(/\/$/, "")}/v1/share`;
}

export async function requestShare(opts: {
  origin: string;
  title?: string;
  sidecarOrigin?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<ShareResult> {
  const command = shareCommand(opts.origin);
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 2000;
  const url = shareEndpoint(opts.sidecarOrigin);

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ origin: opts.origin, title: opts.title }),
        signal: ac.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      return { ok: false, command, reason: "bad-response" };
    }
    const data = (await res.json()) as { url?: unknown };
    if (typeof data.url !== "string" || data.url.length === 0) {
      return { ok: false, command, reason: "bad-response" };
    }
    return { ok: true, url: data.url };
  } catch {
    return { ok: false, command, reason: "sidecar-down" };
  }
}
