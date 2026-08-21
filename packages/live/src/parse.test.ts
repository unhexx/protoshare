import { describe, expect, it } from "vitest";
import { parseCloudflaredUrl, parseZrokShareUrl } from "./parse.ts";

describe("parseZrokShareUrl", () => {
  it("достаёт URL из TUI-рамки zrok v1", () => {
    const text = `
╭──────────────────────────────────────────────────────────────╮
│  ACCESS YOUR ZROK SHARE AT:                                  │
│  https://vcikdowjf9uv.share.zrok.io                          │
╰──────────────────────────────────────────────────────────────╯
`;
    expect(parseZrokShareUrl(text)).toBe("https://vcikdowjf9uv.share.zrok.io");
  });

  it("достаёт URL из headless-лога zrok v2 (shares.zrok.io)", () => {
    const text = `[   0.051]    INFO share: https://sfnblbt17596.shares.zrok.io`;
    expect(parseZrokShareUrl(text)).toBe("https://sfnblbt17596.shares.zrok.io");
  });

  it("достаёт URL из JSON frontendEndpoints", () => {
    const text = JSON.stringify({
      frontendEndpoints: ["https://demo123.share.zrok.io"],
    });
    expect(parseZrokShareUrl(text)).toBe("https://demo123.share.zrok.io");
  });

  it("возвращает null, если публичного URL нет", () => {
    expect(parseZrokShareUrl("environment not enabled")).toBeNull();
  });
});

describe("parseCloudflaredUrl", () => {
  it("достаёт URL из рамки quick tunnel", () => {
    const text = `
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
|  https://random-words-hash.trycloudflare.com                                               |
+--------------------------------------------------------------------------------------------+
`;
    expect(parseCloudflaredUrl(text)).toBe(
      "https://random-words-hash.trycloudflare.com",
    );
  });

  it("достаёт URL из INF-лога", () => {
    expect(
      parseCloudflaredUrl(
        "2024-01-01 INF Registered tunnel connection https://abc-def.trycloudflare.com",
      ),
    ).toBe("https://abc-def.trycloudflare.com");
  });

  it("возвращает null, если URL нет", () => {
    expect(parseCloudflaredUrl("failed to create tunnel")).toBeNull();
  });
});
