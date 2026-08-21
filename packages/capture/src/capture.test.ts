import { createServer } from "node:http";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { captureTarget } from "./capture.ts";

describe("captureTarget", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await close?.();
    close = undefined;
  });

  it("снимает статическую страницу в PNG", async () => {
    const server = createServer((_req, res) => {
      res.setHeader("content-type", "text/html");
      res.end(
        `<html><body style="background:#111;color:#fff"><h1>Proto</h1></body></html>`,
      );
    });
    const origin = await new Promise<string>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const { port } = server.address() as AddressInfo;
        resolve(`http://127.0.0.1:${port}`);
      });
    });
    close = () =>
      new Promise((done) => {
        server.close(() => done());
      });

    const outDir = await mkdtemp(join(tmpdir(), "protoshare-cap-"));
    const shots = await captureTarget({
      kind: "static",
      origin,
      stories: [],
      outDir,
    });

    expect(shots).toHaveLength(1);
    const info = await stat(shots[0].file);
    expect(info.size).toBeGreaterThan(100);
  });
});
