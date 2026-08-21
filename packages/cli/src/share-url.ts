import {
  recordShare as defaultRecordShare,
  type RecordShareInput,
  type RecordShareResult,
} from "@protoshare/core";

export type ShareUrlParts = {
  live?: string;
  remote?: string;
  gallery?: string;
};

function firstUrl(...urls: Array<string | undefined>): string | undefined {
  for (const url of urls) {
    const trimmed = url?.trim();
    if (trimmed) return trimmed;
  }
}

/** Session — что открыть сейчас. Catalog — что останется в list после Ctrl+C. */
export function resolveShareUrl(
  parts: ShareUrlParts,
  use: "session" | "catalog",
): string | undefined {
  if (use === "session") return firstUrl(parts.live, parts.remote, parts.gallery);
  return firstUrl(parts.remote, parts.live, parts.gallery);
}

export type PersistShareInput = ShareUrlParts & {
  slug: string;
  title: string;
  origin: string;
  recordShare?: (input: RecordShareInput) => Promise<RecordShareResult>;
};

export type PersistShareResult = {
  sessionUrl?: string;
  catalogUrl?: string;
  catalog: RecordShareResult;
};

/** Каталог — catalog URL, clipboard/QR — session URL. */
export async function persistShare(input: PersistShareInput): Promise<PersistShareResult> {
  const parts = { live: input.live, remote: input.remote, gallery: input.gallery };
  const catalogUrl = resolveShareUrl(parts, "catalog");
  const sessionUrl = resolveShareUrl(parts, "session");
  const catalog = await (input.recordShare ?? defaultRecordShare)({
    slug: input.slug,
    title: input.title,
    origin: input.origin,
    url: catalogUrl,
  });
  return { sessionUrl, catalogUrl, catalog };
}
