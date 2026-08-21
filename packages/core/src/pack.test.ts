import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { packGallery } from "./pack.ts";

describe("packGallery", () => {
  it("кладёт index.html и снимки в gallery.tgz", async () => {
    const dir = await mkdtemp(join(tmpdir(), "protoshare-pack-"));
    await mkdir(join(dir, "shots"), { recursive: true });
    await writeFile(join(dir, "index.html"), "<html><body>gallery-ok</body></html>");
    await writeFile(join(dir, "manifest.json"), JSON.stringify({ slug: "preview" }));
    await writeFile(join(dir, "shots", "preview.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const archive = await packGallery(dir);
    expect(archive).toBe(join(dir, "gallery.tgz"));

    const tar = gunzipSync(await readFile(archive));
    const text = tar.toString("latin1");
    expect(text).toContain("index.html");
    expect(text).toContain("manifest.json");
    expect(text).toContain("shots/preview.png");
    expect(text).toContain("gallery-ok");
  });

  it("не кладёт сам архив внутрь при повторной упаковке", async () => {
    const dir = await mkdtemp(join(tmpdir(), "protoshare-pack-"));
    await writeFile(join(dir, "index.html"), "<p>once</p>");
    await packGallery(dir);
    await packGallery(dir);
    const tar = gunzipSync(await readFile(join(dir, "gallery.tgz")));
    const names = tar.toString("latin1");
    expect(names.match(/gallery\.tgz/g) ?? []).toHaveLength(0);
  });
});
