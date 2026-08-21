import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { buildOverlay } from "./build.ts";

const overlayRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

type OverlayPackage = {
  name: string;
  description?: string;
  license?: string;
  type?: string;
  files?: string[];
  engines?: { node?: string };
  exports?: Record<string, string>;
  publishConfig?: { access?: string };
  repository?: { url?: string };
  peerDependencies?: Record<string, string>;
};

describe("npm package @protoshare/overlay", () => {
  it("экспортирует собранный JS, не ts-исходники", async () => {
    const pkg = JSON.parse(
      await readFile(join(overlayRoot, "package.json"), "utf8"),
    ) as OverlayPackage;
    expect(pkg.name).toBe("@protoshare/overlay");
    expect(pkg.description?.length ?? 0).toBeGreaterThan(10);
    expect(pkg.license).toBe("MIT");
    expect(pkg.type).toBe("module");
    expect(pkg.files).toEqual(expect.arrayContaining(["dist"]));
    expect(pkg.engines?.node).toMatch(/>=\s*20/);
    expect(pkg.repository?.url).toMatch(/github\.com\/unhexx\/protoshare/);
    expect(pkg.publishConfig?.access).toBe("public");
    expect(pkg.exports).toMatchObject({
      ".": "./dist/index.js",
      "./vite": "./dist/vite.js",
      "./storybook": "./dist/storybook.js",
      "./manager": "./dist/manager.js",
      "./next": "./dist/next.js",
    });
    expect(pkg.peerDependencies?.react).toBeTruthy();
    expect(pkg.peerDependencies?.storybook).toBeTruthy();
  });
});

describe("buildOverlay", () => {
  it("собирает vite/storybook/next entry без tsx", async () => {
    const dist = await buildOverlay({ root: overlayRoot });
    const viteSrc = await readFile(join(dist, "vite.js"), "utf8");
    expect(viteSrc).toContain("protoshare-overlay");
    expect(viteSrc).not.toMatch(/from ["']\.\/vite\.ts["']/);

    const nextSrc = await readFile(join(dist, "next.js"), "utf8");
    expect(nextSrc.startsWith('"use client"')).toBe(true);

    const storySrc = await readFile(join(dist, "storybook.js"), "utf8");
    expect(storySrc).toContain("@protoshare/overlay/manager");

    const { protoshareOverlay } = (await import(
      pathToFileURL(join(dist, "vite.js")).href
    )) as { protoshareOverlay: () => { name: string } };
    expect(protoshareOverlay().name).toBe("protoshare-overlay");
  });
});
