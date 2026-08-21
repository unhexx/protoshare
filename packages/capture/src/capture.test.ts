import { createServer } from "node:http";
import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  captureTarget,
  CHROMIUM_INSTALL_HINT,
  isMissingChromiumError,
  MissingChromiumError,
} from "./capture.ts";

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

  it("подсказывает установку Chromium, если launch бросает missing browser", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "protoshare-cap-miss-"));
    const missing = new Error(
      "browserType.launch: Executable doesn't exist at /tmp/ms-playwright/chromium/chrome",
    );
    await expect(
      captureTarget(
        { kind: "static", origin: "http://127.0.0.1:9", stories: [], outDir },
        {
          launch: async () => {
            throw missing;
          },
        },
      ),
    ).rejects.toMatchObject({
      name: "MissingChromiumError",
      message: CHROMIUM_INSTALL_HINT,
      hint: CHROMIUM_INSTALL_HINT,
    });
  });

  it("пробрасывает другие ошибки launch без подсказки", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "protoshare-cap-fail-"));
    const closed = new Error("Target closed");
    await expect(
      captureTarget(
        { kind: "static", origin: "http://127.0.0.1:9", stories: [], outDir },
        {
          launch: async () => {
            throw closed;
          },
        },
      ),
    ).rejects.toBe(closed);
  });
});

describe("isMissingChromiumError", () => {
  it("распознаёт Executable doesn't exist и browserNotInstalled", () => {
    expect(isMissingChromiumError(new Error("Executable doesn't exist at /x"))).toBe(true);
    const named = new Error("Chromium is not installed");
    named.name = "browserNotInstalled";
    expect(isMissingChromiumError(named)).toBe(true);
    expect(isMissingChromiumError(new MissingChromiumError())).toBe(true);
    expect(isMissingChromiumError(new Error("net::ERR_CONNECTION_REFUSED"))).toBe(false);
    const stacked = new Error("spawn failed");
    stacked.stack = "Error: spawn failed\n    at browserNotInstalled";
    expect(isMissingChromiumError(stacked)).toBe(false);
  });
});
