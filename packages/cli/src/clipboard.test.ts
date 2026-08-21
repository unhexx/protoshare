import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { copyToClipboard } from "./clipboard.ts";

describe("copyToClipboard", () => {
  it("пустой текст — ok:false без spawn", async () => {
    let called = 0;
    const result = await copyToClipboard("  ", {
      run: async () => {
        called += 1;
        return { ok: true };
      },
    });
    expect(result.ok).toBe(false);
    expect(called).toBe(0);
  });

  it("берёт первый рабочий инструмент", async () => {
    const tried: string[] = [];
    const result = await copyToClipboard("https://share.example/preview", {
      tools: [
        { cmd: "missing", args: [] },
        { cmd: "pbcopy", args: [] },
      ],
      run: async (cmd, _args, text) => {
        tried.push(cmd);
        if (cmd === "missing") return { ok: false, detail: "missing" };
        expect(text).toBe("https://share.example/preview");
        return { ok: true };
      },
    });
    expect(result.ok).toBe(true);
    expect(tried).toEqual(["missing", "pbcopy"]);
  });

  it("все инструменты мертвы — ok:false", async () => {
    const result = await copyToClipboard("https://x", {
      tools: [{ cmd: "nope", args: [] }],
      run: async () => ({ ok: false, detail: "missing" }),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.detail).toContain("missing");
  });

  it("реально пишет URL в stdin бинаря", async () => {
    const dir = await mkdtemp(join(tmpdir(), "protoshare-clip-"));
    const out = join(dir, "clip.txt");
    const bin = join(dir, "clip");
    await writeFile(
      bin,
      `#!/usr/bin/env node
const fs = require("node:fs");
const chunks = [];
process.stdin.on("data", (c) => chunks.push(c));
process.stdin.on("end", () => {
  fs.writeFileSync(${JSON.stringify(out)}, Buffer.concat(chunks));
});
`,
      { encoding: "utf8", mode: 0o755 },
    );
    await chmod(bin, 0o755);
    const result = await copyToClipboard("https://live.example/x", {
      tools: [{ cmd: bin, args: [] }],
    });
    expect(result.ok).toBe(true);
    expect(await readFile(out, "utf8")).toBe("https://live.example/x");
  });
});
