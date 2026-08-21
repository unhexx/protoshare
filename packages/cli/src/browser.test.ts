import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { httpShareUrl, openInBrowser } from "./browser.ts";

describe("httpShareUrl", () => {
  it("принимает только http(s)", () => {
    expect(httpShareUrl("https://share.example/x")).toBe("https://share.example/x");
    expect(httpShareUrl("http://127.0.0.1:4177/")).toBe("http://127.0.0.1:4177/");
    expect(httpShareUrl("javascript:alert(1)")).toBeNull();
    expect(httpShareUrl("file:///tmp/x")).toBeNull();
    expect(httpShareUrl("")).toBeNull();
  });
});

describe("openInBrowser", () => {
  it("не http — ok:false без spawn", async () => {
    let called = 0;
    const result = await openInBrowser("file:///tmp/x", {
      run: async () => {
        called += 1;
        return { ok: true };
      },
    });
    expect(result.ok).toBe(false);
    expect(called).toBe(0);
  });

  it("берёт первый рабочий opener", async () => {
    const tried: string[] = [];
    const result = await openInBrowser("https://share.example/preview", {
      tools: [
        { cmd: "missing", args: ["https://share.example/preview"] },
        { cmd: "xdg-open", args: ["https://share.example/preview"] },
      ],
      run: async (cmd) => {
        tried.push(cmd);
        return cmd === "xdg-open" ? { ok: true } : { ok: false, detail: "missing" };
      },
    });
    expect(result.ok).toBe(true);
    expect(tried).toEqual(["missing", "xdg-open"]);
  });

  it("реально передаёт URL аргументом", async () => {
    const dir = await mkdtemp(join(tmpdir(), "protoshare-open-"));
    const out = join(dir, "opened.txt");
    const bin = join(dir, "open-url");
    await writeFile(
      bin,
      `#!/usr/bin/env node
require("node:fs").writeFileSync(${JSON.stringify(out)}, process.argv.slice(2).join(" "));
`,
      { encoding: "utf8", mode: 0o755 },
    );
    await chmod(bin, 0o755);
    const result = await openInBrowser("http://127.0.0.1:4177/", {
      tools: [{ cmd: bin, args: ["http://127.0.0.1:4177/"] }],
    });
    expect(result.ok).toBe(true);
    let body = "";
    for (let i = 0; i < 40; i++) {
      try {
        body = await readFile(out, "utf8");
        if (body) break;
      } catch {
        // ещё пишет
      }
      await new Promise((r) => setTimeout(r, 25));
    }
    expect(body).toBe("http://127.0.0.1:4177/");
  });
});
