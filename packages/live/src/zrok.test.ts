import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { tryZrokShare } from "./zrok.ts";

async function writeFake(name: string, body: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "protoshare-zrok-"));
  const path = join(dir, name);
  await writeFile(path, body, { encoding: "utf8", mode: 0o755 });
  await chmod(path, 0o755);
  return path;
}

describe("tryZrokShare", () => {
  let stop: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await stop?.();
    stop = undefined;
  });

  it("не падает, если бинаря zrok нет — откат на snapshots", async () => {
    const result = await tryZrokShare({
      localOrigin: "http://127.0.0.1:4177",
      binaries: ["/no/such/protoshare-zrok"],
      timeoutMs: 500,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("missing-binary");
  });

  it("поднимает live URL из stdout фейкового zrok", async () => {
    const bin = await writeFake(
      "zrok",
      `#!/usr/bin/env node
process.stdout.write("https://demo.share.zrok.io\\n");
process.on("SIGTERM", () => process.exit(0));
setInterval(() => {}, 1 << 30);
`,
    );
    const result = await tryZrokShare({
      localOrigin: "http://127.0.0.1:4177",
      binaries: [bin],
      timeoutMs: 2000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.provider).toBe("zrok");
    expect(result.url).toBe("https://demo.share.zrok.io");
    stop = result.stop;
    await result.stop();
    stop = undefined;
  });

  it("при падении share откатывается, а не бросает", async () => {
    const bin = await writeFake(
      "zrok",
      `#!/usr/bin/env node
process.stderr.write("unable to create share: environment not enabled\\n");
process.exit(1);
`,
    );
    const result = await tryZrokShare({
      localOrigin: "http://127.0.0.1:4177",
      binaries: [bin],
      timeoutMs: 2000,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("share-failed");
    expect(result.detail.toLowerCase()).toContain("not enabled");
  });

  it("если URL так и не появился — timeout и процесс гасится", async () => {
    const bin = await writeFake(
      "zrok",
      `#!/usr/bin/env node
process.stdout.write("starting...\\n");
process.on("SIGTERM", () => process.exit(0));
setInterval(() => {}, 1 << 30);
`,
    );
    const result = await tryZrokShare({
      localOrigin: "http://127.0.0.1:4177",
      binaries: [bin],
      timeoutMs: 250,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("timeout");
  });
});
