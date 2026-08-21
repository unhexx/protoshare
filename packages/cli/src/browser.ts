import { spawn } from "node:child_process";

export type OpenResult = { ok: true } | { ok: false; detail: string };

export type OpenTool = { cmd: string; args: string[] };

export type OpenRun = (cmd: string, args: string[]) => Promise<{ ok: boolean; detail?: string }>;

export function httpShareUrl(url: string): string | null {
  const raw = url.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function browserTools(url: string): OpenTool[] {
  return [
    { cmd: "xdg-open", args: [url] },
    { cmd: "open", args: [url] },
    { cmd: "cmd", args: ["/c", "start", "", url] },
  ];
}

export function defaultOpenRun(
  cmd: string,
  args: string[],
): Promise<{ ok: boolean; detail?: string }> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (result: { ok: boolean; detail?: string }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    let child;
    try {
      child = spawn(cmd, args, { stdio: "ignore", detached: true });
    } catch (err) {
      done({ ok: false, detail: err instanceof Error ? err.message : String(err) });
      return;
    }

    child.once("error", (err) => {
      const code = (err as NodeJS.ErrnoException).code;
      done({ ok: false, detail: code === "ENOENT" ? "missing" : err.message });
    });
    child.once("spawn", () => {
      child.unref();
      done({ ok: true });
    });
  });
}

/** Открывает http(s) URL в браузере. Нет бинаря — ok:false, без throw. */
export async function openInBrowser(
  url: string,
  opts: { run?: OpenRun; tools?: OpenTool[] } = {},
): Promise<OpenResult> {
  const href = httpShareUrl(url);
  if (!href) return { ok: false, detail: "not-http" };
  const run = opts.run ?? defaultOpenRun;
  const tools = opts.tools ?? browserTools(href);
  let last = "browser не найден";
  for (const tool of tools) {
    const result = await run(tool.cmd, tool.args);
    if (result.ok) return { ok: true };
    last = result.detail || last;
  }
  return { ok: false, detail: last };
}
