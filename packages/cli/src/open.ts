import { resolve } from "node:path";
import {
  findGalleryDir,
  type FindGalleryResult,
} from "@protoshare/core";
import { startShareServer, type ShareServer } from "@protoshare/share-app";
import { DEFAULT_OUT_DIR } from "./rm.ts";

export type RunOpenOpts = {
  slug?: string;
  outDir?: string;
  port?: number;
  findGalleryDir?: (opts: { outRoot: string; slug: string }) => Promise<FindGalleryResult>;
  startShareServer?: (opts: { root: string; port: number }) => Promise<ShareServer>;
  log?: (line: string) => void;
  error?: (line: string) => void;
};

export type RunOpenResult =
  | { ok: true; slug: string; origin: string; dir: string; stop: () => Promise<void> }
  | { ok: false; detail: string };

/** Поднимает локальную gallery сохранённой шары. Ошибка — ok:false, без throw. */
export async function runOpen(opts: RunOpenOpts): Promise<RunOpenResult> {
  const log = opts.log ?? console.log;
  const error = opts.error ?? console.error;
  const slug = opts.slug?.trim() ?? "";
  if (!slug) {
    error("Нужен slug: protoshare open <slug>");
    return { ok: false, detail: "нужен slug" };
  }
  const outRoot = resolve(opts.outDir ?? DEFAULT_OUT_DIR);
  const found = await (opts.findGalleryDir ?? findGalleryDir)({ outRoot, slug });
  if (!found.ok) {
    error(`Gallery: пропуск (${found.detail})`);
    return { ok: false, detail: found.detail };
  }
  const port = Number.isFinite(opts.port) ? Number(opts.port) : 4177;
  try {
    const server = await (opts.startShareServer ?? startShareServer)({
      root: found.dir,
      port,
    });
    log(`Share:   ${found.slug}`);
    log(`Gallery: ${server.origin}`);
    return {
      ok: true,
      slug: found.slug,
      origin: server.origin,
      dir: found.dir,
      stop: server.stop,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    error(`Gallery: пропуск (${detail})`);
    return { ok: false, detail };
  }
}
