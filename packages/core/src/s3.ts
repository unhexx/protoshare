import { createHash, createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { UploadResult } from "./upload.ts";

export type S3EnvConfig = {
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  region: string;
  prefix: string;
};

export function s3ConfigFromEnv(
  env: NodeJS.Dict<string> = process.env,
): S3EnvConfig | null {
  const endpoint = (env.PROTOSHARE_S3_ENDPOINT || env.AWS_ENDPOINT_URL || "").replace(/\/$/, "");
  const bucket = env.PROTOSHARE_S3_BUCKET || env.AWS_S3_BUCKET || "";
  const accessKey = env.PROTOSHARE_S3_ACCESS_KEY || env.AWS_ACCESS_KEY_ID || "";
  const secretKey = env.PROTOSHARE_S3_SECRET_KEY || env.AWS_SECRET_ACCESS_KEY || "";
  const region = env.PROTOSHARE_S3_REGION || env.AWS_REGION || "auto";
  let prefix = env.PROTOSHARE_S3_PREFIX || "";
  prefix = prefix.replace(/^\/+/, "");
  if (prefix && !prefix.endsWith("/")) prefix += "/";
  if (!endpoint || !bucket || !accessKey || !secretKey) return null;
  return { endpoint, bucket, accessKey, secretKey, region, prefix };
}

export function s3ObjectKey(prefix: string, slug: string, file = "gallery.tgz"): string {
  return `${prefix}${slug}/${file}`.replace(/^\/+/, "");
}

export function s3ObjectUrl(endpoint: string, bucket: string, key: string): string {
  return `${endpoint.replace(/\/$/, "")}/${bucket}/${key}`;
}

export function formatAmzDate(now: Date): { amz: string; date: string } {
  const amz = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amz, date: amz.slice(0, 8) };
}

function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: string | Buffer, data: string | Buffer): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function encodePath(path: string): string {
  return path
    .split("/")
    .map((seg) =>
      encodeURIComponent(seg).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`),
    )
    .join("/");
}

export function signS3Put(opts: {
  endpoint: string;
  bucket: string;
  key: string;
  accessKey: string;
  secretKey: string;
  region: string;
  payload: Uint8Array;
  now?: Date;
  contentType?: string;
}): { url: string; headers: Record<string, string>; canonicalRequest: string } {
  const endpoint = opts.endpoint.replace(/\/$/, "");
  const url = s3ObjectUrl(endpoint, opts.bucket, opts.key);
  const host = new URL(endpoint).host;
  const { amz, date } = formatAmzDate(opts.now ?? new Date());
  const payloadHash = sha256Hex(opts.payload);
  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amz,
  };
  if (opts.contentType) headers["content-type"] = opts.contentType;

  const signedNames = Object.keys(headers).map((n) => n.toLowerCase()).sort();
  const canonicalHeaders = signedNames.map((n) => `${n}:${headers[n]!.trim()}\n`).join("");
  const signedHeaders = signedNames.join(";");
  const canonicalPath = encodePath(`/${opts.bucket}/${opts.key}`);
  const canonicalRequest = [
    "PUT",
    canonicalPath,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${date}/${opts.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amz,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmac(`AWS4${opts.secretKey}`, date);
  const kRegion = hmac(kDate, opts.region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = hmac(kSigning, stringToSign).toString("hex");

  headers.authorization = `AWS4-HMAC-SHA256 Credential=${opts.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return { url, headers, canonicalRequest };
}

export async function uploadArchiveS3(opts: {
  file: string;
  config: S3EnvConfig;
  key: string;
  publicUrl?: string;
  fetchImpl?: typeof fetch;
  now?: Date;
}): Promise<UploadResult> {
  let body: Buffer;
  try {
    body = await readFile(opts.file);
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
  let signed: ReturnType<typeof signS3Put>;
  try {
    signed = signS3Put({
      endpoint: opts.config.endpoint,
      bucket: opts.config.bucket,
      key: opts.key,
      accessKey: opts.config.accessKey,
      secretKey: opts.config.secretKey,
      region: opts.config.region,
      payload: new Uint8Array(body),
      now: opts.now,
    });
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
  const publicUrl = opts.publicUrl?.trim() || signed.url;
  const fetchImpl = opts.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(signed.url, {
      method: "PUT",
      headers: signed.headers,
      body: new Uint8Array(body),
    });
    if (!res.ok) {
      const text = (await res.text().catch(() => "")).slice(0, 200);
      return { ok: false, detail: text || `upload HTTP ${res.status}` };
    }
    return { ok: true, url: publicUrl };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}
