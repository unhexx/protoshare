import { resolve } from "node:path";
import {
  removeGalleryDir,
  removeShare,
  type RemoveGalleryResult,
  type RemoveShareResult,
  type SharesConfig,
} from "@protoshare/core";

export const DEFAULT_OUT_DIR = ".protoshare/out";

export type RunRmOpts = {
  slug?: string;
  outDir?: string;
  files?: boolean;
  config?: SharesConfig;
  removeShare?: (opts: { slug: string; config?: SharesConfig }) => Promise<RemoveShareResult>;
  removeGalleryDir?: (opts: { outRoot: string; slug: string }) => Promise<RemoveGalleryResult>;
  log?: (line: string) => void;
  error?: (line: string) => void;
};

export type RunRmResult =
  | { ok: true; slug: string; files: "removed" | "missing" | "skipped" }
  | { ok: false; detail: string };

/** Удаляет шару из каталога и файлы gallery. Ошибка libsql не бросается наружу. */
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
    if (opts.files === false) {
      return { ok: true, slug: result.slug, files: "skipped" };
    }
    const outRoot = resolve(opts.outDir ?? DEFAULT_OUT_DIR);
    try {
      const files = await (opts.removeGalleryDir ?? removeGalleryDir)({
        outRoot,
        slug: result.slug,
      });
      if (!files.ok) {
        log(`Files:    пропуск (${files.detail})`);
        return { ok: true, slug: result.slug, files: "skipped" };
      }
      if (files.removed) {
        log(`Files:    ${files.dir}`);
        return { ok: true, slug: result.slug, files: "removed" };
      }
      log("Files:    пропуск (нет файлов)");
      return { ok: true, slug: result.slug, files: "missing" };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      log(`Files:    пропуск (${detail})`);
      return { ok: true, slug: result.slug, files: "skipped" };
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    error(`Catalog: пропуск (${detail})`);
    return { ok: false, detail };
  }
}
