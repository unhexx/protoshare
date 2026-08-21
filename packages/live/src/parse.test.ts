import { describe, expect, it } from "vitest";
import { parseZrokShareUrl } from "./parse.ts";

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
