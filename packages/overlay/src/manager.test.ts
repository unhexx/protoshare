import { describe, expect, it } from "vitest";
import {
  ADDON_ID,
  TOOL_ID,
  createShareButtonRender,
  onShareClick,
  registerShareAddon,
} from "./manager.ts";

describe("onShareClick", () => {
  it("копирует url с сайдкара", async () => {
    const copied: string[] = [];
    const out = await onShareClick({
      origin: "http://127.0.0.1:6006",
      title: "Button",
      fetchImpl: async () =>
        new Response(JSON.stringify({ url: "https://checkout.share.zrok.io" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      clipboardWrite: async (text) => {
        copied.push(text);
      },
    });
    expect(out).toEqual({ text: "https://checkout.share.zrok.io", copied: true });
    expect(copied).toEqual(["https://checkout.share.zrok.io"]);
  });

  it("если сайдкар молчит — копирует команду CLI", async () => {
    const out = await onShareClick({
      origin: "http://127.0.0.1:5173",
      fetchImpl: async () => {
        throw new Error("ECONNREFUSED");
      },
    });
    expect(out.copied).toBe(false);
    expect(out.text).toBe("npx protoshare http://127.0.0.1:5173");
  });
});

describe("registerShareAddon", () => {
  it("регистрирует TOOL в manager", () => {
    const added: { id: string; descriptor: Record<string, unknown> }[] = [];
    const addons = {
      register: (id: string, cb: () => void) => {
        expect(id).toBe(ADDON_ID);
        cb();
      },
      add: (id: string, descriptor: Record<string, unknown>) => {
        added.push({ id, descriptor });
      },
    };
    const render = () => "share-tool";
    registerShareAddon(addons, { TOOL: "tool" }, render);
    expect(added).toHaveLength(1);
    expect(added[0]?.id).toBe(TOOL_ID);
    expect(added[0]?.descriptor.type).toBe("tool");
    expect(added[0]?.descriptor.title).toBe("protoshare");
    expect(added[0]?.descriptor.render).toBe(render);
    const match = added[0]?.descriptor.match as (ctx: { viewMode?: string }) => boolean;
    expect(match({ viewMode: "story" })).toBe(true);
    expect(match({ viewMode: "settings" })).toBe(false);
  });
});

describe("createShareButtonRender", () => {
  it("по клику шарит текущий origin", async () => {
    const statuses: string[] = [];
    const render = createShareButtonRender({
      createElement: (type, props, ...children) => ({ type, props, children }),
      getOrigin: () => "http://127.0.0.1:6006",
      getTitle: () => "Storybook",
      fetchImpl: async () =>
        new Response(JSON.stringify({ url: "http://127.0.0.1:4177" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      onStatus: (text) => {
        statuses.push(text);
      },
    });
    const node = render() as {
      type: string;
      props: { "data-protoshare"?: string; onClick?: () => Promise<void> };
      children: unknown[];
    };
    expect(node.type).toBe("button");
    expect(node.props["data-protoshare"]).toBe("manager-share");
    expect(node.children).toContain("Share");
    await node.props.onClick?.();
    expect(statuses).toEqual(["http://127.0.0.1:4177"]);
  });
});
