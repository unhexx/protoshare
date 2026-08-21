import { encode, renderUnicodeCompact } from "uqr";
import { httpShareUrl } from "./browser.ts";

export type QrResult = { ok: true; text: string } | { ok: false; detail: string };

export type QrMatrix =
  | { ok: true; size: number; data: boolean[][] }
  | { ok: false; detail: string };

/** Матрица QR для http(s) URL. Иначе ok:false, без throw. */
export function encodeShareQr(url: string): QrMatrix {
  const href = httpShareUrl(url);
  if (!href) return { ok: false, detail: "not-http" };
  try {
    const encoded = encode(href, { border: 0 });
    const data = toMatrix(encoded.data, encoded.size);
    if (data.length < 21) return { ok: false, detail: "empty" };
    return { ok: true, size: data.length, data };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

/** Компактный unicode QR шары. Не http / ошибка — ok:false, без throw. */
export function renderShareQr(url: string): QrResult {
  const href = httpShareUrl(url);
  if (!href) return { ok: false, detail: "not-http" };
  try {
    const text = renderUnicodeCompact(href, { border: 1 });
    if (!text.trim()) return { ok: false, detail: "empty" };
    return { ok: true, text };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

function toMatrix(data: boolean[][] | boolean[], size: number): boolean[][] {
  if (Array.isArray(data[0])) return data as boolean[][];
  const flat = data as boolean[];
  const rows: boolean[][] = [];
  for (let y = 0; y < size; y++) {
    rows.push(flat.slice(y * size, (y + 1) * size));
  }
  return rows;
}
