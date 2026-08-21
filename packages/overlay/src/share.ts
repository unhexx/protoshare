export const DEFAULT_SIDECAR = "http://127.0.0.1:4178";
export const DEFAULT_SHARE_TIMEOUT_MS = 120_000; // lockstep with capture/budget.ts

export type ShareOk = {
  ok: true;
  url: string;
  captured?: number;
  total?: number;
};

export type ShareFallback =
  | { ok: false; reason: "share-in-progress" }
  | { ok: false; reason: "sidecar-down" | "bad-response"; command: string };

export type ShareResult = ShareOk | ShareFallback;

export function shareCommand(origin: string): string {
  return `npx protoshare ${origin}`;
}

export function shareEndpoint(sidecarOrigin: string = DEFAULT_SIDECAR): string {
  return `${sidecarOrigin.replace(/\/$/, "")}/v1/share`;
}

export function storyIdFromLocation(search: string): string | undefined {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const id = q.get("id")?.trim();
  if (id) return id;
  const path = q.get("path")?.trim();
  if (!path) return undefined;
  const marker = "/story/";
  const idx = path.indexOf(marker);
  const raw = idx >= 0 ? path.slice(idx + marker.length) : path.replace(/^\//, "");
  const normalized = raw.replaceAll("/", "-").trim();
  return normalized || undefined;
}

export function statusForShare(result: ShareResult): string {
  if (result.ok) {
    if (typeof result.captured === "number" && typeof result.total === "number") {
      return `Captured ${result.captured} / ${result.total} stories`;
    }
    return result.url;
  }
  if (result.reason === "share-in-progress") return "Share already in progress";
  return result.command;
}

export function clipboardTextForShare(result: ShareResult): string | undefined {
  if (result.ok) return result.url;
  if (result.reason === "share-in-progress") return undefined;
  return result.command;
}

export async function requestShare(opts: {
  origin: string;
  title?: string;
  storyId?: string;
  sidecarOrigin?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<ShareResult> {
  const command = shareCommand(opts.origin);
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_SHARE_TIMEOUT_MS;
  const url = shareEndpoint(opts.sidecarOrigin);

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          origin: opts.origin,
          title: opts.title,
          storyId: opts.storyId,
        }),
        signal: ac.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 409) {
      return { ok: false, reason: "share-in-progress" };
    }
    if (!res.ok) {
      return { ok: false, command, reason: "bad-response" };
    }
    const data = (await res.json()) as {
      url?: unknown;
      captured?: unknown;
      total?: unknown;
    };
    if (typeof data.url !== "string" || data.url.length === 0) {
      return { ok: false, command, reason: "bad-response" };
    }
    const captured = typeof data.captured === "number" ? data.captured : undefined;
    const total = typeof data.total === "number" ? data.total : undefined;
    return { ok: true, url: data.url, captured, total };
  } catch {
    return { ok: false, command, reason: "sidecar-down" };
  }
}
