import { listShares, type ShareRow, type SharesConfig } from "@protoshare/core";

export function formatShareList(rows: ShareRow[]): string {
  if (rows.length === 0) return "Нет шар в каталоге.";
  return rows
    .map((row) => {
      const href = row.url?.trim() || row.origin;
      return `${row.slug}  ${href}  ${row.title}`;
    })
    .join("\n");
}

export type RunListOpts = {
  limit?: number;
  config?: SharesConfig;
  listShares?: (opts: { limit?: number; config?: SharesConfig }) => Promise<ShareRow[]>;
  log?: (line: string) => void;
  error?: (line: string) => void;
};

export type RunListResult =
  | { ok: true; count: number }
  | { ok: false; detail: string };

/** Печатает каталог шар. Ошибка libsql не бросается наружу. */
export async function runList(opts: RunListOpts = {}): Promise<RunListResult> {
  const log = opts.log ?? console.log;
  const error = opts.error ?? console.error;
  try {
    const rows = await (opts.listShares ?? listShares)({
      limit: opts.limit,
      config: opts.config,
    });
    log(formatShareList(rows));
    return { ok: true, count: rows.length };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    error(`Catalog: пропуск (${detail})`);
    return { ok: false, detail };
  }
}
