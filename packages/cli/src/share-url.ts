export type ShareUrlParts = {
  live?: string;
  remote?: string;
  gallery?: string;
};

function firstUrl(...urls: Array<string | undefined>): string | undefined {
  return urls.find((url) => Boolean(url));
}

/** Session — что открыть сейчас. Catalog — что останется в list после Ctrl+C. */
export function resolveShareUrl(
  parts: ShareUrlParts,
  use: "session" | "catalog",
): string | undefined {
  if (use === "session") return firstUrl(parts.live, parts.remote, parts.gallery);
  return firstUrl(parts.remote, parts.live, parts.gallery);
}
