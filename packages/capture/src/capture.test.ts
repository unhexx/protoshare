import { createServer } from "node:http";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { STORY_GOTO_TIMEOUT_MS, STORY_SETTLE_MS } from "./budget.ts";
import {
  captureTarget,
  CHROMIUM_INSTALL_HINT,
  isMissingChromiumError,
  MissingChromiumError,
  storyReadyTimeoutMs,
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

  it("для Storybook ждёт ребенка #storybook-root и ставит storyId первым", async () => {
    const server = createServer((_req, res) => {
      res.setHeader("content-type", "text/html");
      res.end(`<!doctype html><html><body>
        <div id="storybook-root"><p>mounted story</p></div>
      </body></html>`);
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

    const outDir = await mkdtemp(join(tmpdir(), "protoshare-sb-"));
    const shots = await captureTarget({
      kind: "storybook",
      origin,
      stories: [
        { id: "a--one", title: "A", name: "One" },
        { id: "button--primary", title: "Button", name: "Primary" },
      ],
      storyId: "button--primary",
      outDir,
    });

    expect(shots.map((s) => s.id)).toEqual(["button--primary", "a--one"]);
    for (const shot of shots) {
      const info = await stat(shot.file);
      expect(info.size).toBeGreaterThan(100);
    }
  });

  it("если селектор не дождались — всё равно пишет PNG", async () => {
    const server = createServer((_req, res) => {
      res.setHeader("content-type", "text/html");
      res.end(`<!doctype html><html data-is-storybook>
        <body><div id="storybook-root"></div></body>
      </html>`);
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

    const outDir = await mkdtemp(join(tmpdir(), "protoshare-empty-"));
    const shots = await captureTarget({
      kind: "storybook",
      origin,
      stories: [{ id: "empty--root", title: "Empty", name: "Root" }],
      outDir,
    });

    expect(shots).toHaveLength(1);
    const info = await stat(shots[0].file);
    expect(info.size).toBeGreaterThan(100);
  });

  it("не считает готовым [data-is-storybook] и не использует waitForTimeout", async () => {
    const src = await readFile(
      join(dirname(fileURLToPath(import.meta.url)), "capture.ts"),
      "utf8",
    );
    expect(src).toContain("STORY_READY_SELECTOR");
    expect(src).toContain("STORY_WAIT_UNTIL");
    expect(src).toContain("selectStories");
    expect(src).toContain("setTimeout");
    expect(src).toContain("storyReadyTimeoutMs");
    expect(src).not.toContain("data-is-storybook");
    expect(src).not.toContain("waitForTimeout");
    expect(src).not.toContain("networkidle");
    expect(src).not.toContain('"#storybook-root"');
    expect(src).not.toMatch(/timeout:\s*Math\.max\(0/);
    expect(src).not.toMatch(/waitFor\(\{[\s\S]*timeout:\s*0/);
  });

  it("таймаут goto одной истории не роняет остальные", async () => {
    const server = createServer((req, res) => {
      if ((req.url ?? "").includes("hang--story")) return;
      res.setHeader("content-type", "text/html");
      res.end(`<!doctype html><html><body>
        <div id="storybook-root"><p>ok</p></div>
      </body></html>`);
    });
    const origin = await new Promise<string>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const { port } = server.address() as AddressInfo;
        resolve(`http://127.0.0.1:${port}`);
      });
    });
    close = () =>
      new Promise((done) => {
        server.closeAllConnections();
        server.close(() => done());
      });

    const outDir = await mkdtemp(join(tmpdir(), "protoshare-hang-"));
    const shots = await captureTarget({
      kind: "storybook",
      origin,
      stories: [
        { id: "hang--story", title: "Hang", name: "Story" },
        { id: "ok--story", title: "Ok", name: "Story" },
      ],
      outDir,
    });

    expect(shots.map((s) => s.id)).toContain("ok--story");
    const ok = shots.find((s) => s.id === "ok--story");
    const info = await stat(ok!.file);
    expect(info.size).toBeGreaterThan(100);
  });
});

describe("storyReadyTimeoutMs", () => {
  it("не возвращает 0 — Playwright тогда ждёт бесконечно", () => {
    expect(storyReadyTimeoutMs(0)).toBe(STORY_GOTO_TIMEOUT_MS - STORY_SETTLE_MS);
    expect(storyReadyTimeoutMs(STORY_GOTO_TIMEOUT_MS - STORY_SETTLE_MS)).toBeNull();
    expect(storyReadyTimeoutMs(STORY_GOTO_TIMEOUT_MS)).toBeNull();
    expect(storyReadyTimeoutMs(STORY_GOTO_TIMEOUT_MS + 1_000)).toBeNull();
    expect(storyReadyTimeoutMs(100)).toBeGreaterThan(0);
  });
});

describe("missing Chromium", () => {
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
