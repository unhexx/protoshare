import { readFile } from "node:fs/promises";

export type UploadOk = { ok: true; url: string };
export type UploadFail = { ok: false; detail: string };
export type UploadResult = UploadOk | UploadFail;

/** Публичный URL объекта: presigned query отбрасываем. */
export function publicObjectUrl(putUrl: string): string {
  const url = new URL(putUrl);
  url.search = "";
  url.hash = "";
  return url.toString();
}

export async function uploadArchive(opts: {
  file: string;
  putUrl: string;
  publicUrl?: string;
  contentType?: string;
  fetchImpl?: typeof fetch;
}): Promise<UploadResult> {
  let body: Buffer;
  try {
    body = await readFile(opts.file);
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  let publicUrl: string;
  try {
    publicUrl = opts.publicUrl?.trim() || publicObjectUrl(opts.putUrl);
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  const fetchImpl = opts.fetchImpl ?? fetch;
  try {
    const headers: Record<string, string> = {};
    if (opts.contentType) headers["content-type"] = opts.contentType;
    const res = await fetchImpl(opts.putUrl, {
      method: "PUT",
      headers,
      body: new Uint8Array(body),
    });
    if (!res.ok) {
      const text = (await res.text().catch(() => "")).slice(0, 200);
      return {
        ok: false,
        detail: text || `upload HTTP ${res.status}`,
      };
    }
    return { ok: true, url: publicUrl };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
