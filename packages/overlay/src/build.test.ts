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
  exports?: Record<string, string | { types?: string; import?: string }>;
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
    expect(pkg.files).toEqual(expect.arrayContaining(["dist", "LICENSE", "README.md"]));
    const readme = await readFile(join(overlayRoot, "README.md"), "utf8");
    expect(readme).toMatch(/@protoshare\/overlay/);
    expect(readme).toMatch(/protoshareOverlay/);
    expect(pkg.engines?.node).toMatch(/>=\s*20/);
    expect(pkg.repository?.url).toMatch(/github\.com\/unhexx\/protoshare/);
    expect(pkg.publishConfig?.access).toBe("public");
    expect(pkg.exports).toMatchObject({
      ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
      "./vite": { types: "./dist/vite.d.ts", import: "./dist/vite.js" },
      "./storybook": { types: "./dist/storybook.d.ts", import: "./dist/storybook.js" },
      "./manager": { types: "./dist/manager-entry.d.ts", import: "./dist/manager.js" },
      "./next": { types: "./dist/next-entry.d.ts", import: "./dist/next.js" },
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

    const viteDts = await readFile(join(dist, "vite.d.ts"), "utf8");
    expect(viteDts).toContain("protoshareOverlay");
    expect(viteDts).not.toMatch(/from ["']\.\/script\.ts["']/);
    expect(viteDts).toMatch(/from ["']\.\/script\.js["']/);
    const indexDts = await readFile(join(dist, "index.d.ts"), "utf8");
    expect(indexDts).toContain("requestShare");
    const nextDts = await readFile(join(dist, "next-entry.d.ts"), "utf8");
    expect(nextDts).toContain("ProtoshareOverlay");
  });
});
