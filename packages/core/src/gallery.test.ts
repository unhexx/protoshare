import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeGallery } from "./gallery.ts";

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
});
