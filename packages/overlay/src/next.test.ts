import { describe, expect, it } from "vitest";
import { injectOverlayScript, NEXT_SCRIPT_ID, protoshareScriptProps } from "./next.ts";

describe("protoshareScriptProps", () => {
  it("даёт props для next/script с overlay IIFE", () => {
    const props = protoshareScriptProps({ sidecarOrigin: "http://127.0.0.1:4199" });
    expect(props.id).toBe(NEXT_SCRIPT_ID);
    expect(props.strategy).toBe("afterInteractive");
    expect(props.dangerouslySetInnerHTML.__html).toContain(
      "http://127.0.0.1:4199/v1/share",
    );
    expect(props.dangerouslySetInnerHTML.__html).toContain("protoshare-overlay");
  });
});

describe("injectOverlayScript", () => {
  it("вставляет script в documentElement", () => {
    const kids: { id?: string; attrs: Record<string, string>; text: string | null }[] = [];
    const doc = {
      createElement: (tag: string) => {
        expect(tag).toBe("script");
        const el = {
          attrs: {} as Record<string, string>,
          textContent: null as string | null,
          setAttribute(name: string, value: string) {
            el.attrs[name] = value;
          },
          remove() {},
        };
        return el;
      },
      documentElement: {
        appendChild(el: { attrs: Record<string, string>; textContent: string | null }) {
          kids.push({ attrs: el.attrs, text: el.textContent });
        },
      },
    };
    injectOverlayScript(doc);
    expect(kids).toHaveLength(1);
    expect(kids[0]?.attrs.id).toBe(NEXT_SCRIPT_ID);
    expect(kids[0]?.attrs["data-protoshare"]).toBe("next-script");
    expect(kids[0]?.text).toContain("/v1/share");
  });
});
