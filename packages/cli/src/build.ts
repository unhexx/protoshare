import { chmod } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";

export type BuildCliOpts = {
  root?: string;
};

const defaultRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Собирает `dist/main.js` — один ESM-файл с shebang, playwright снаружи. */
export async function buildCli(opts: BuildCliOpts = {}): Promise<string> {
  const root = opts.root ?? defaultRoot;
  const outfile = join(root, "dist/main.js");
  await esbuild.build({
    absWorkingDir: root,
    entryPoints: [join(root, "src/main.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    outfile,
    banner: { js: "#!/usr/bin/env node" },
    external: ["playwright"],
    logLevel: "silent",
  });
  await chmod(outfile, 0o755);
  return outfile;
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
  await buildCli();
}
