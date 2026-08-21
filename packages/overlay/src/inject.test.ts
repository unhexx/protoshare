import { describe, expect, it } from "vitest";
import { injectOverlay, OVERLAY_SCRIPT_SRC } from "./inject.ts";

describe("injectOverlay", () => {
  it("вставляет скрипт перед </body>", () => {
    const html = injectOverlay("<html><body><h1>app</h1></body></html>");
    expect(html).toContain(`<script src="${OVERLAY_SCRIPT_SRC}"></script></body>`);
  });

  it("дописывает скрипт, если body нет", () => {
    const html = injectOverlay("<html></html>", "/overlay.js");
    expect(html).toBe('<html></html><script src="/overlay.js"></script>');
  });
});
