import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { tryLiveShare } from "./live-share.ts";

async function writeFake(name: string, body: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "protoshare-live-"));
  const path = join(dir, name);
  await writeFile(path, body, { encoding: "utf8", mode: 0o755 });
  await chmod(path, 0o755);
  return path;
}

describe("tryLiveShare", () => {
  let stop: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await stop?.();
    stop = undefined;
  });

  it("берёт zrok, если он поднялся", async () => {
    const zrok = await writeFake(
      "zrok",
      `#!/usr/bin/env node
process.stdout.write("https://first.share.zrok.io\\n");
process.on("SIGTERM", () => process.exit(0));
setInterval(() => {}, 1 << 30);
`,
    );
    const result = await tryLiveShare({
      localOrigin: "http://127.0.0.1:4177",
      zrokBinaries: [zrok],
      cloudflaredBinaries: ["/no/such/cloudflared"],
      timeoutMs: 2000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.provider).toBe("zrok");
    expect(result.url).toBe("https://first.share.zrok.io");
    stop = result.stop;
    await result.stop();
    stop = undefined;
  });

  it("если zrok нет — откатывается на cloudflared", async () => {
    const cf = await writeFake(
      "cloudflared",
      `#!/usr/bin/env node
process.stdout.write("https://fallback.trycloudflare.com\\n");
process.on("SIGTERM", () => process.exit(0));
setInterval(() => {}, 1 << 30);
`,
    );
    const result = await tryLiveShare({
      localOrigin: "http://127.0.0.1:4177",
      zrokBinaries: ["/no/such/zrok"],
      cloudflaredBinaries: [cf],
      timeoutMs: 2000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.provider).toBe("cloudflared");
    expect(result.url).toBe("https://fallback.trycloudflare.com");
    stop = result.stop;
    await result.stop();
    stop = undefined;
  });

  it("если нет ни zrok, ни cloudflared — мягкий откат", async () => {
    const result = await tryLiveShare({
      localOrigin: "http://127.0.0.1:4177",
      zrokBinaries: ["/no/such/zrok"],
      cloudflaredBinaries: ["/no/such/cloudflared"],
      timeoutMs: 500,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("missing-binary");
    expect(result.detail.toLowerCase()).toContain("zrok");
    expect(result.detail.toLowerCase()).toContain("cloudflared");
  });
});
