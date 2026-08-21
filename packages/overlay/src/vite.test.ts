import { describe, expect, it } from "vitest";
import { OVERLAY_SCRIPT_SRC } from "./inject.ts";
import { protoshareOverlay } from "./vite.ts";

describe("protoshareOverlay", () => {
  it("вставляет overlay в html dev-сервера", () => {
    const plugin = protoshareOverlay();
    expect(plugin.name).toBe("protoshare-overlay");
    expect(plugin.apply).toBe("serve");
    const html = plugin.transformIndexHtml("<html><body>app</body></html>");
    expect(html).toContain(OVERLAY_SCRIPT_SRC);
  });

  it("отдаёт клиентский скрипт с dev-middleware", () => {
    const plugin = protoshareOverlay({ sidecarOrigin: "http://127.0.0.1:4199" });
    const handlers: Parameters<typeof plugin.configureServer>[0]["middlewares"] extends {
      use: infer U;
    }
      ? U extends (fn: infer F) => void
        ? F[]
        : never
      : never = [];
    plugin.configureServer({
      middlewares: {
        use(fn) {
          handlers.push(fn);
        },
      },
    });
    expect(handlers).toHaveLength(1);

    let body = "";
    let ctype = "";
    let nexted = false;
    handlers[0](
      { url: OVERLAY_SCRIPT_SRC + "?t=1" },
      {
        setHeader(k, v) {
          if (k === "content-type") ctype = v;
        },
        end(s) {
          body = s;
        },
      },
      () => {
        nexted = true;
      },
    );
    expect(nexted).toBe(false);
    expect(ctype).toContain("javascript");
    expect(body).toContain("http://127.0.0.1:4199/v1/share");

    nexted = false;
    handlers[0]({ url: "/other.js" }, { setHeader() {}, end() {} }, () => {
      nexted = true;
    });
    expect(nexted).toBe(true);
  });
});
