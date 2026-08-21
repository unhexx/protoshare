import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatAmzDate,
  s3ConfigFromEnv,
  s3ObjectKey,
  s3ObjectUrl,
  signS3Put,
  uploadArchiveS3,
} from "./s3.ts";

describe("s3ConfigFromEnv", () => {
  it("собирает endpoint/bucket/ключи", () => {
    expect(
      s3ConfigFromEnv({
        PROTOSHARE_S3_ENDPOINT: "https://abc.r2.cloudflarestorage.com/",
        PROTOSHARE_S3_BUCKET: "shares",
        AWS_ACCESS_KEY_ID: "AKIAEXAMPLE",
        AWS_SECRET_ACCESS_KEY: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
        PROTOSHARE_S3_PREFIX: "proto",
      }),
    ).toEqual({
      endpoint: "https://abc.r2.cloudflarestorage.com",
      bucket: "shares",
      accessKey: "AKIAEXAMPLE",
      secretKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
      region: "auto",
      prefix: "proto/",
    });
  });

  it("без ключей — null", () => {
    expect(s3ConfigFromEnv({ PROTOSHARE_S3_BUCKET: "shares" })).toBeNull();
  });
});

describe("signS3Put", () => {
  const now = new Date("2026-08-21T13:40:00.000Z");

  it("даёт стабильную SigV4-подпись", () => {
    const payload = new Uint8Array(Buffer.from("tgz-bytes"));
    const signed = signS3Put({
      endpoint: "https://abc.r2.cloudflarestorage.com",
      bucket: "shares",
      key: "preview/gallery.tgz",
      accessKey: "AKIAEXAMPLE",
      secretKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
      region: "auto",
      payload,
      now,
    });
    expect(formatAmzDate(now)).toEqual({ amz: "20260821T134000Z", date: "20260821" });
    expect(signed.url).toBe(
      "https://abc.r2.cloudflarestorage.com/shares/preview/gallery.tgz",
    );
    expect(signed.canonicalRequest).toContain("PUT\n/shares/preview/gallery.tgz\n");
    expect(signed.headers["x-amz-date"]).toBe("20260821T134000Z");
    expect(signed.headers.authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE\/20260821\/auto\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/,
    );
    const again = signS3Put({
      endpoint: "https://abc.r2.cloudflarestorage.com",
      bucket: "shares",
      key: "preview/gallery.tgz",
      accessKey: "AKIAEXAMPLE",
      secretKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
      region: "auto",
      payload,
      now,
    });
    expect(again.headers.authorization).toBe(signed.headers.authorization);
  });

  it("другой секрет — другая подпись", () => {
    const payload = new Uint8Array([1, 2, 3]);
    const a = signS3Put({
      endpoint: "https://s3.example",
      bucket: "b",
      key: "k",
      accessKey: "A",
      secretKey: "secret-a",
      region: "us-east-1",
      payload,
      now,
    });
    const b = signS3Put({
      endpoint: "https://s3.example",
      bucket: "b",
      key: "k",
      accessKey: "A",
      secretKey: "secret-b",
      region: "us-east-1",
      payload,
      now,
    });
    expect(a.headers.authorization).not.toBe(b.headers.authorization);
  });
});

describe("uploadArchiveS3", () => {
  it("PUTит с Authorization и возвращает object URL", async () => {
    const dir = await mkdtemp(join(tmpdir(), "protoshare-s3-"));
    const file = join(dir, "gallery.tgz");
    await writeFile(file, "tgz-bytes");
    let auth = "";
    const result = await uploadArchiveS3({
      file,
      key: s3ObjectKey("proto/", "preview"),
      config: {
        endpoint: "https://abc.r2.cloudflarestorage.com",
        bucket: "shares",
        accessKey: "AKIAEXAMPLE",
        secretKey: "secret",
        region: "auto",
        prefix: "proto/",
      },
      now: new Date("2026-08-21T13:40:00.000Z"),
      fetchImpl: async (input, init) => {
        expect(init?.method).toBe("PUT");
        expect(String(input)).toBe(
          s3ObjectUrl("https://abc.r2.cloudflarestorage.com", "shares", "proto/preview/gallery.tgz"),
        );
        auth = String((init?.headers as Record<string, string>).authorization);
        return new Response(null, { status: 200 });
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url).toContain("proto/preview/gallery.tgz");
    expect(auth).toMatch(/^AWS4-HMAC-SHA256 /);
  });
});
