import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { detectTarget } from "./detect.ts";

const STORY_INDEX = {
  v: 5,
  entries: {
    "button--primary": {
      type: "story",
      id: "button--primary",
      name: "Primary",
      title: "Button",
    },
    "docs-intro--docs": {
      type: "docs",
      id: "docs-intro--docs",
      name: "Docs",
      title: "Intro",
    },
  },
};

function listen(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<{ origin: string; close: () => Promise<void> }> {
  const server = createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        origin: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise((done) => {
            server.close(() => done());
          }),
      });
    });
  });
}

describe("detectTarget", () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await close?.();
    close = undefined;
  });

  it("распознаёт Storybook по /index.json и берёт только stories", async () => {
    const srv = await listen((req, res) => {
      if (req.url === "/index.json") {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(STORY_INDEX));
        return;
      }
      res.statusCode = 404;
      res.end();
    });
    close = srv.close;

    const target = await detectTarget(srv.origin);
    expect(target.kind).toBe("storybook");
    expect(target.origin).toBe(srv.origin);
    expect(target.stories).toEqual([
      { id: "button--primary", title: "Button", name: "Primary" },
    ]);
  });

  it("распознаёт Vite по клиентскому скрипту", async () => {
    const srv = await listen((_req, res) => {
      res.setHeader("content-type", "text/html");
      res.end(
        `<html><head><script type="module" src="/@vite/client"></script></head><body>app</body></html>`,
      );
    });
    close = srv.close;

    const target = await detectTarget(srv.origin);
    expect(target.kind).toBe("vite");
    expect(target.stories).toEqual([]);
  });
});
