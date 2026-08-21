import { spawn, type ChildProcess } from "node:child_process";
import { access, constants } from "node:fs/promises";
import { delimiter, join } from "node:path";
import { parseCloudflaredUrl } from "./parse.ts";
import { galleryBind, type LiveShareResult } from "./zrok.ts";

export type TryCloudflaredShareOpts = {
  localOrigin: string;
  binaries?: string[];
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_NAMES = ["cloudflared"];

async function which(cmd: string): Promise<string | null> {
  if (cmd.includes("/") || cmd.includes("\\")) {
    try {
      await access(cmd, constants.X_OK);
      return cmd;
    } catch {
      return null;
    }
  }
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (!dir) continue;
    try {
      const candidate = join(dir, cmd);
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

async function resolveBinaries(explicit?: string[]): Promise<string[]> {
  if (explicit && explicit.length > 0) return explicit;
  const found: string[] = [];
  for (const name of DEFAULT_NAMES) {
    const path = await which(name);
    if (path) found.push(path);
  }
  return found;
}

function errCode(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    return String((err as { code: unknown }).code);
  }
  return "";
}

function stopChild(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode) {
      resolve();
      return;
    }
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
    setTimeout(() => {
      if (child.exitCode === null && !child.signalCode) {
        child.kill("SIGKILL");
      }
    }, 1500);
  });
}

function runOne(
  binary: string,
  target: string,
  timeoutMs: number,
): Promise<LiveShareResult> {
  return new Promise((resolve) => {
    let settled = false;
    let buf = "";
    let child: ChildProcess;

    try {
      child = spawn(binary, ["tunnel", "--url", target, "--no-autoupdate"], {
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      });
    } catch (err) {
      if (errCode(err) === "ENOENT") {
        resolve({
          ok: false,
          reason: "missing-binary",
          detail: `cloudflared не найден (${binary})`,
        });
        return;
      }
      resolve({
        ok: false,
        reason: "share-failed",
        detail: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    const finish = (result: LiveShareResult) => {
      if (settled) return false;
      settled = true;
      clearTimeout(timer);
      resolve(result);
      return true;
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      void stopChild(child).then(() => {
        resolve({
          ok: false,
          reason: "timeout",
          detail: "cloudflared не отдал публичный URL вовремя",
        });
      });
    }, timeoutMs);

    child.on("error", (err) => {
      if (errCode(err) === "ENOENT") {
        finish({
          ok: false,
          reason: "missing-binary",
          detail: `cloudflared не найден (${binary})`,
        });
        return;
      }
      finish({
        ok: false,
        reason: "share-failed",
        detail: err.message,
      });
    });

    const onData = (chunk: Buffer | string) => {
      buf += chunk.toString();
      const url = parseCloudflaredUrl(buf);
      if (!url) return;
      finish({
        ok: true,
        provider: "cloudflared",
        url,
        stop: () => stopChild(child),
      });
    };

    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);

    child.on("exit", (code) => {
      if (settled) return;
      const detail = buf.trim() || `cloudflared завершился с кодом ${code ?? "null"}`;
      finish({
        ok: false,
        reason: "share-failed",
        detail: detail.slice(0, 400),
      });
    });
  });
}

/** Quick tunnel cloudflared. При ошибке — мягкий откат, без throw. */
export async function tryCloudflaredShare(
  opts: TryCloudflaredShareOpts,
): Promise<LiveShareResult> {
  let target: string;
  try {
    target = `http://${galleryBind(opts.localOrigin)}`;
  } catch (err) {
    return {
      ok: false,
      reason: "share-failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  const binaries = await resolveBinaries(opts.binaries);
  if (binaries.length === 0) {
    return {
      ok: false,
      reason: "missing-binary",
      detail: "cloudflared не найден в PATH",
    };
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let last: LiveShareResult | undefined;
  for (const binary of binaries) {
    const result = await runOne(binary, target, timeoutMs);
    if (result.ok) return result;
    last = result;
    if (result.reason !== "missing-binary") return result;
  }
  return (
    last ?? {
      ok: false,
      reason: "missing-binary",
      detail: "cloudflared не найден в PATH",
    }
  );
}
