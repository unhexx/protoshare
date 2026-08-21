const ZROK_HOST_URL =
  /https:\/\/[a-zA-Z0-9._-]+\.(?:share|shares)\.zrok\.io\b/;
const CLOUDFLARED_URL = /https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/i;

function fromEndpoints(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const endpoints = rec.frontendEndpoints ?? rec.frontend_endpoints;
  if (!Array.isArray(endpoints)) return null;
  const first = endpoints.find((item) => typeof item === "string" && item.startsWith("https://"));
  return typeof first === "string" ? first : null;
}

/** Публичный URL из stdout/stderr zrok (TUI, headless-лог или JSON). */
export function parseZrokShareUrl(text: string): string | null {
  const hosted = text.match(ZROK_HOST_URL);
  if (hosted) return hosted[0];

  try {
    const fromJson = fromEndpoints(JSON.parse(text));
    if (fromJson) return fromJson;
  } catch {
    // лог может быть смешан с JSON-строками
  }

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const fromJson = fromEndpoints(JSON.parse(trimmed));
      if (fromJson) return fromJson;
    } catch {
      continue;
    }
  }

  return null;
}

/** Публичный URL quick tunnel из лога cloudflared. */
export function parseCloudflaredUrl(text: string): string | null {
  const match = text.match(CLOUDFLARED_URL);
  return match ? match[0].toLowerCase() : null;
}
