import { resolve } from "node:path";
import {
  findGalleryDir,
  listShares,
  type ShareRow,
  type SharesConfig,
} from "@protoshare/core";
import { DEFAULT_OUT_DIR } from "./rm.ts";

export type ShareListRow = ShareRow & { local: boolean };

export function formatShareList(rows: Array<ShareRow & { local?: boolean }>): string {
  if (rows.length === 0) return "Нет шар в каталоге.";
  return rows
    .map((row) => {
      const href = row.url?.trim() || row.origin;
      const local = row.local ? "  local" : "";
      return `${row.slug}  ${href}  ${row.title}${local}`;
    })
    .join("\n");
}

export type RunListOpts = {
  limit?: number;
  json?: boolean;
  outDir?: string;
  config?: SharesConfig;
  listShares?: (opts: { limit?: number; config?: SharesConfig }) => Promise<ShareRow[]>;
  hasLocal?: (slug: string) => Promise<boolean>;
  log?: (line: string) => void;
  error?: (line: string) => void;
};

export type RunListResult =
  | { ok: true; count: number }
  | { ok: false; detail: string };

async function defaultHasLocal(outRoot: string, slug: string): Promise<boolean> {
  const found = await findGalleryDir({ outRoot, slug });
  return found.ok;
}

/** Печатает каталог шар. Ошибка libsql не бросается наружу. */
export async function runList(opts: RunListOpts = {}): Promise<RunListResult> {
  const log = opts.log ?? console.log;
  const error = opts.error ?? console.error;
  try {
    const rows = await (opts.listShares ?? listShares)({
      limit: opts.limit,
      config: opts.config,
    });
    const outRoot = resolve(opts.outDir ?? DEFAULT_OUT_DIR);
    const hasLocal = opts.hasLocal ?? ((slug: string) => defaultHasLocal(outRoot, slug));
    const annotated: ShareListRow[] = await Promise.all(
      rows.map(async (row) => {
        let local = false;
        try {
          local = await hasLocal(row.slug);
        } catch {
          local = false;
        }
        return { ...row, local };
      }),
    );
    log(opts.json ? JSON.stringify(annotated, null, 2) : formatShareList(annotated));
    return { ok: true, count: rows.length };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    error(`Catalog: пропуск (${detail})`);
    return { ok: false, detail };
  }
}
