import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

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

/** Собирает `dist/*.js` — ESM-entry для Vite / Storybook / Next. */
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
