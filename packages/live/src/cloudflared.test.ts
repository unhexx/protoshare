import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { tryCloudflaredShare } from "./cloudflared.ts";

async function writeFake(name: string, body: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "protoshare-cf-"));
  const path = join(dir, name);
  await writeFile(path, body, { encoding: "utf8", mode: 0o755 });
  await chmod(path, 0o755);
  return path;
}

describe("tryCloudflaredShare", () => {
  let stop: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await stop?.();
    stop = undefined;
  });

  it("не падает, если cloudflared нет — откат на snapshots", async () => {
    const result = await tryCloudflaredShare({
      localOrigin: "http://127.0.0.1:4177",
      binaries: ["/no/such/protoshare-cloudflared"],
      timeoutMs: 500,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("missing-binary");
  });

  it("поднимает live URL из stdout фейкового cloudflared", async () => {
    const bin = await writeFake(
      "cloudflared",
      `#!/usr/bin/env node
process.stderr.write("https://demo-words.trycloudflare.com\\n");
process.on("SIGTERM", () => process.exit(0));
setInterval(() => {}, 1 << 30);
`,
    );
    const result = await tryCloudflaredShare({
      localOrigin: "http://127.0.0.1:4177",
      binaries: [bin],
      timeoutMs: 2000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.provider).toBe("cloudflared");
    expect(result.url).toBe("https://demo-words.trycloudflare.com");
    stop = result.stop;
    await result.stop();
    stop = undefined;
  });

  it("если URL так и не появился — timeout", async () => {
    const bin = await writeFake(
      "cloudflared",
      `#!/usr/bin/env node
process.stdout.write("starting tunnel...\\n");
process.on("SIGTERM", () => process.exit(0));
setInterval(() => {}, 1 << 30);
`,
    );
    const result = await tryCloudflaredShare({
      localOrigin: "http://127.0.0.1:4177",
      binaries: [bin],
      timeoutMs: 250,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("timeout");
  });
});
