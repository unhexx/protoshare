import { removeShare, type RemoveShareResult, type SharesConfig } from "@protoshare/core";

export type RunRmOpts = {
  slug?: string;
  config?: SharesConfig;
  removeShare?: (opts: { slug: string; config?: SharesConfig }) => Promise<RemoveShareResult>;
  log?: (line: string) => void;
  error?: (line: string) => void;
};

export type RunRmResult = { ok: true; slug: string } | { ok: false; detail: string };

/** Удаляет шару из каталога. Ошибка libsql не бросается наружу. */
export async function runRm(opts: RunRmOpts): Promise<RunRmResult> {
  const log = opts.log ?? console.log;
  const error = opts.error ?? console.error;
  const slug = opts.slug?.trim() ?? "";
  if (!slug) {
    error("Нужен slug: protoshare rm <slug>");
    return { ok: false, detail: "нужен slug" };
  }
  try {
    const result = await (opts.removeShare ?? removeShare)({
      slug,
      config: opts.config,
    });
    if (!result.ok) {
      error(`Catalog: пропуск (${result.detail})`);
      return { ok: false, detail: result.detail };
    }
    log(`Удалено: ${result.slug}`);
    return { ok: true, slug: result.slug };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    error(`Catalog: пропуск (${detail})`);
    return { ok: false, detail };
  }
}
