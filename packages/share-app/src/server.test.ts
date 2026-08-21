import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { startShareServer } from "./server.ts";

describe("startShareServer", () => {
  let stop: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await stop?.();
    stop = undefined;
  });

  it("отдаёт gallery index.html", async () => {
    const dir = await mkdtemp(join(tmpdir(), "protoshare-share-"));
    await mkdir(join(dir, "shots"), { recursive: true });
    await writeFile(join(dir, "index.html"), "<html><body>gallery-ok</body></html>");

    const server = await startShareServer({ root: dir, port: 0 });
    stop = server.stop;

    const res = await fetch(server.origin + "/");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("gallery-ok");
  });
});
