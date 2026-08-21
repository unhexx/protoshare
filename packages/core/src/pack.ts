import { createWriteStream } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { createGzip } from "node:zlib";

const BLOCK = 512;
const ARCHIVE_NAME = "gallery.tgz";

async function listFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listFiles(path)));
    } else if (entry.isFile()) {
      out.push(path);
    }
  }
  return out;
}

function posixRel(root: string, file: string): string {
  return relative(root, file).split(sep).join("/");
}

function tarHeader(name: string, size: number): Buffer {
  const buf = Buffer.alloc(BLOCK);
  Buffer.from(name).copy(buf, 0, 0, Math.min(100, name.length));
  buf.write("0000644\0", 100, 8, "utf8");
  buf.write("0000000\0", 108, 8, "utf8");
  buf.write("0000000\0", 116, 8, "utf8");
  buf.write(`${size.toString(8).padStart(11, "0")}\0`, 124, 12, "utf8");
  buf.write("00000000000\0", 136, 12, "utf8");
  buf.write("        ", 148, 8, "utf8");
  buf.write("0", 156, "utf8");
  buf.write("ustar\0", 257, 6, "utf8");
  buf.write("00", 263, 2, "utf8");
  let sum = 0;
  for (let i = 0; i < BLOCK; i++) sum += buf[i]!;
  buf.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, 8, "utf8");
  return buf;
}

function padBlock(size: number): Buffer | null {
  const rem = size % BLOCK;
  return rem === 0 ? null : Buffer.alloc(BLOCK - rem);
}

/** Упаковывает gallery в `{outDir}/gallery.tgz` (ustar + gzip). */
export async function packGallery(
  outDir: string,
  archivePath: string = join(outDir, ARCHIVE_NAME),
): Promise<string> {
  const files = (await listFiles(outDir)).filter((file) => {
    const rel = posixRel(outDir, file);
    return rel !== ARCHIVE_NAME && !rel.endsWith(`/${ARCHIVE_NAME}`);
  });
  files.sort();

  const chunks: Buffer[] = [];
  for (const file of files) {
    const rel = posixRel(outDir, file);
    if (!rel || rel.startsWith("..")) continue;
    const info = await stat(file);
    const data = await readFile(file);
    chunks.push(tarHeader(rel, info.size), data);
    const pad = padBlock(data.length);
    if (pad) chunks.push(pad);
  }
  chunks.push(Buffer.alloc(BLOCK * 2));

  await pipeline(Readable.from([Buffer.concat(chunks)]), createGzip(), createWriteStream(archivePath));
  return archivePath;
}
