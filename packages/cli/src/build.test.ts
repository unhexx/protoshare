import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { buildCli } from "./build.ts";

const execFileAsync = promisify(execFile);
const cliRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

type CliPackage = {
  name: string;
  description?: string;
  license?: string;
  type?: string;
  bin?: Record<string, string>;
  files?: string[];
  engines?: { node?: string };
  dependencies?: Record<string, string>;
  repository?: { url?: string };
};

describe("npm package protoshare", () => {
  it("описывает публичный bin на собранный JS", async () => {
    const pkg = JSON.parse(await readFile(join(cliRoot, "package.json"), "utf8")) as CliPackage;
    expect(pkg.name).toBe("protoshare");
    expect(pkg.description?.length ?? 0).toBeGreaterThan(10);
    expect(pkg.license).toBe("MIT");
    expect(pkg.type).toBe("module");
    expect(pkg.bin?.protoshare).toBe("./dist/main.js");
    expect(pkg.files).toEqual(expect.arrayContaining(["dist"]));
    expect(pkg.engines?.node).toMatch(/>=\s*20/);
    expect(pkg.repository?.url).toMatch(/github\.com\/unhexx\/protoshare/);
    expect(pkg.dependencies?.playwright).toBeTruthy();
    expect(pkg.dependencies?.["@protoshare/core"]).toBeUndefined();
    expect(pkg.dependencies?.["@protoshare/capture"]).toBeUndefined();
    expect(pkg.dependencies?.citty).toBeUndefined();
  });
});

describe("buildCli", () => {
  it("собирает node-bin с shebang и --help без tsx", async () => {
    const outfile = await buildCli({ root: cliRoot });
    const source = await readFile(outfile, "utf8");
    expect(source.startsWith("#!/usr/bin/env node")).toBe(true);
    expect(source).not.toMatch(/npx tsx/);
    const env = { ...process.env, NODE_ENV: "production" };
    delete env.TEST;
    const { stdout } = await execFileAsync(process.execPath, [outfile, "--help"], {
      timeout: 15_000,
      encoding: "utf8",
      env,
    });
    expect(stdout).toMatch(/protoshare/i);
    expect(stdout).toMatch(/--out/);
    expect(stdout).toMatch(/\blist\b/);
    expect(stdout).toMatch(/--no-copy|--copy/);
  });
});
