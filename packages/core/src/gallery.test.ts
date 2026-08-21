import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { galleryDir, removeGalleryDir, writeGallery } from "./gallery.ts";

describe("writeGallery", () => {
  it("кладёт index.html и манифест со снимками", async () => {
    const dir = await mkdtemp(join(tmpdir(), "protoshare-"));
    const shot = join(dir, "button.png");
    await writeGallery({
      outDir: join(dir, "gallery"),
      title: "Button",
      origin: "http://127.0.0.1:6006",
      shots: [{ id: "button--primary", title: "Button / Primary", file: shot }],
    });

    const html = await readFile(join(dir, "gallery", "index.html"), "utf8");
    expect(html).toContain("Button / Primary");
    expect(html).toContain("shots/button--primary.png");

    const manifest = JSON.parse(
      await readFile(join(dir, "gallery", "manifest.json"), "utf8"),
    );
    expect(manifest.slug).toBe("button");
    expect(manifest.shots).toHaveLength(1);
  });

  it("принимает явный vanity-slug вместо заголовка", async () => {
    const dir = await mkdtemp(join(tmpdir(), "protoshare-"));
    const result = await writeGallery({
      outDir: join(dir, "gallery"),
      title: "Button",
      origin: "http://127.0.0.1:6006",
      slug: "Checkout / Flow",
      shots: [],
    });

    expect(result.slug).toBe("checkout-flow");
    const manifest = JSON.parse(
      await readFile(join(dir, "gallery", "manifest.json"), "utf8"),
    );
    expect(manifest.slug).toBe("checkout-flow");
  });
});

describe("galleryDir", () => {
  it("кладёт slug внутрь outRoot", () => {
    const dir = galleryDir("/tmp/protoshare/out", "checkout");
    expect(dir).toBe("/tmp/protoshare/out/checkout");
  });

  it("нормализует slug и не выходит из outRoot", () => {
    expect(galleryDir("/tmp/out", "Checkout / Flow")).toBe("/tmp/out/checkout-flow");
    expect(galleryDir("/tmp/out", "../etc")).toBe("/tmp/out/etc");
    expect(galleryDir("/tmp/out", "..")).toBeNull();
    expect(galleryDir("/tmp/out", "")).toBeNull();
    expect(galleryDir("/tmp/out", "   ")).toBeNull();
  });
});

describe("removeGalleryDir", () => {
  it("удаляет каталог шары", async () => {
    const root = await mkdtemp(join(tmpdir(), "protoshare-rm-"));
    const outDir = join(root, "checkout");
    await writeGallery({
      outDir,
      title: "Checkout",
      origin: "http://127.0.0.1:6006",
      slug: "checkout",
      shots: [],
    });
    const sibling = join(root, "keep-sibling.txt");
    await writeFile(sibling, "stay");

    const result = await removeGalleryDir({ outRoot: root, slug: "checkout" });
    expect(result).toMatchObject({ ok: true, removed: true });
    if (!result.ok) return;
    expect(result.dir).toBe(outDir);
    await expect(access(outDir)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(sibling, "utf8")).resolves.toBe("stay");
  });

  it("нет каталога — ok, removed:false", async () => {
    const root = await mkdtemp(join(tmpdir(), "protoshare-rm-"));
    const result = await removeGalleryDir({ outRoot: root, slug: "gone" });
    expect(result).toEqual({ ok: true, dir: join(root, "gone"), removed: false });
  });

  it("небезопасный slug — ok:false без удаления соседей", async () => {
    const root = await mkdtemp(join(tmpdir(), "protoshare-rm-"));
    const marker = join(root, "marker.txt");
    await mkdir(join(root, "etc"), { recursive: true });
    await writeFile(marker, "stay");
    const result = await removeGalleryDir({ outRoot: root, slug: ".." });
    expect(result.ok).toBe(false);
    await expect(readFile(marker, "utf8")).resolves.toBe("stay");
  });
});
