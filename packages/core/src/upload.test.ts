import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { publicObjectUrl, uploadArchive } from "./upload.ts";

describe("publicObjectUrl", () => {
  it("снимает query у presigned URL", () => {
    expect(
      publicObjectUrl(
        "https://bucket.r2.cloudflarestorage.com/preview/gallery.tgz?X-Amz-Signature=secret",
      ),
    ).toBe("https://bucket.r2.cloudflarestorage.com/preview/gallery.tgz");
  });
});

describe("uploadArchive", () => {
  it("делает PUT тела архива и возвращает публичный URL", async () => {
    const dir = await mkdtemp(join(tmpdir(), "protoshare-up-"));
    const file = join(dir, "gallery.tgz");
    await writeFile(file, Buffer.from("tgz-bytes"));

    const puts: { url: string; body: string }[] = [];
    const result = await uploadArchive({
      file,
      putUrl:
        "https://bucket.r2.cloudflarestorage.com/preview/gallery.tgz?X-Amz-Signature=secret",
      publicUrl: "https://share.example/preview/gallery.tgz",
      fetchImpl: async (input, init) => {
        expect(init?.method).toBe("PUT");
        puts.push({
          url: String(input),
          body: Buffer.from(init?.body as Buffer).toString(),
        });
        return new Response(null, { status: 200 });
      },
    });
    expect(result).toEqual({
      ok: true,
      url: "https://share.example/preview/gallery.tgz",
    });
    expect(puts).toEqual([
      {
        url: "https://bucket.r2.cloudflarestorage.com/preview/gallery.tgz?X-Amz-Signature=secret",
        body: "tgz-bytes",
      },
    ]);
  });

  it("при HTTP-ошибке не бросает — откат", async () => {
    const dir = await mkdtemp(join(tmpdir(), "protoshare-up-"));
    const file = join(dir, "gallery.tgz");
    await writeFile(file, "x");
    const result = await uploadArchive({
      file,
      putUrl: "https://bucket.example/gallery.tgz",
      fetchImpl: async () => new Response("AccessDenied", { status: 403 }),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.detail).toContain("AccessDenied");
  });
});
