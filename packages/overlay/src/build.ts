import { execFile } from "node:child_process";
import { access, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import * as esbuild from "esbuild";

const execFileAsync = promisify(execFile);

export type BuildOverlayOpts = {
  root?: string;
};

const defaultRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const ENTRIES: { in: string; out: string; banner?: string }[] = [
  { in: "src/index.ts", out: "index.js" },
  { in: "src/vite.ts", out: "vite.js" },
  { in: "src/storybook.ts", out: "storybook.js" },
  { in: "src/manager-entry.ts", out: "manager.js" },
  { in: "src/next-entry.ts", out: "next.js", banner: '"use client";' },
];

const EXTERNAL = [
  "react",
  "storybook",
  "storybook/manager-api",
  "@storybook/manager-api",
];

async function resolveTsc(root: string): Promise<string> {
  const candidates = [
    join(root, "node_modules/typescript/bin/tsc"),
    join(root, "../../node_modules/typescript/bin/tsc"),
  ];
  for (const bin of candidates) {
    try {
      await access(bin);
      return bin;
    } catch {
      continue;
    }
  }
  throw new Error("tsc не найден");
}

async function emitDts(root: string): Promise<void> {
  const tsc = await resolveTsc(root);
  try {
    await execFileAsync(process.execPath, [tsc, "-p", join(root, "tsconfig.build.json")], {
      cwd: root,
    });
  } catch (err) {
    const detail =
      err && typeof err === "object" && "stderr" in err
        ? String((err as { stderr: unknown }).stderr || (err as { stdout?: unknown }).stdout)
        : err instanceof Error
          ? err.message
          : String(err);
    throw new Error(`tsc d.ts: ${detail}`.trim());
  }
  await rewriteDtsImports(join(root, "dist"));
}

async function rewriteDtsImports(outdir: string): Promise<void> {
  const files = await readdir(outdir);
  for (const name of files) {
    if (!name.endsWith(".d.ts")) continue;
    const path = join(outdir, name);
    const text = await readFile(path, "utf8");
    const next = text.replaceAll(/from (["'])(\.[^"']+)\.ts\1/g, "from $1$2.js$1");
    if (next !== text) await writeFile(path, next);
  }
}

/** Собирает `dist/*.js` + `.d.ts` — ESM-entry для Vite / Storybook / Next. */
export async function buildOverlay(opts: BuildOverlayOpts = {}): Promise<string> {
  const root = opts.root ?? defaultRoot;
  const outdir = join(root, "dist");
  await Promise.all(
    ENTRIES.map((entry) =>
      esbuild.build({
        absWorkingDir: root,
        entryPoints: [join(root, entry.in)],
        bundle: true,
        platform: "neutral",
        format: "esm",
        target: "es2022",
        outfile: join(outdir, entry.out),
        banner: entry.banner ? { js: entry.banner } : undefined,
        external: EXTERNAL,
        logLevel: "silent",
      }),
    ),
  );
  await emitDts(root);
  return outdir;
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(resolve(entry)).href;
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  await buildOverlay();
}
