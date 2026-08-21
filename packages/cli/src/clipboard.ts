import { spawn } from "node:child_process";

export type CopyResult = { ok: true } | { ok: false; detail: string };

export type ClipTool = { cmd: string; args: string[] };

export type CopyRun = (
  cmd: string,
  args: string[],
  text: string,
) => Promise<{ ok: boolean; detail?: string }>;

export const CLIP_TOOLS: ClipTool[] = [
  { cmd: "wl-copy", args: [] },
  { cmd: "xclip", args: ["-selection", "clipboard"] },
  { cmd: "xsel", args: ["--clipboard", "--input"] },
  { cmd: "pbcopy", args: [] },
  { cmd: "clip", args: [] },
];

export function defaultCopyRun(
  cmd: string,
  args: string[],
  text: string,
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
      child = spawn(cmd, args, { stdio: ["pipe", "ignore", "pipe"] });
    } catch (err) {
      done({ ok: false, detail: err instanceof Error ? err.message : String(err) });
      return;
    }

    child.on("error", (err) => {
      const code = (err as NodeJS.ErrnoException).code;
      done({ ok: false, detail: code === "ENOENT" ? "missing" : err.message });
    });
    child.on("exit", (code) => {
      if (code === 0) done({ ok: true });
      else done({ ok: false, detail: `${cmd} exit ${code ?? "null"}` });
    });
    child.stdin?.on("error", () => {
      // broken pipe after missing binary — ждём error/exit
    });
    child.stdin?.end(text);
  });
}

/** Копирует текст в буфер. Нет бинаря / ошибка — ok:false, без throw. */
export async function copyToClipboard(
  text: string,
  opts: { run?: CopyRun; tools?: ClipTool[] } = {},
): Promise<CopyResult> {
  const value = text.trim();
  if (!value) return { ok: false, detail: "empty" };
  const run = opts.run ?? defaultCopyRun;
  const tools = opts.tools ?? CLIP_TOOLS;
  let last = "clipboard не найден";
  for (const tool of tools) {
    const result = await run(tool.cmd, tool.args, value);
    if (result.ok) return { ok: true };
    last = result.detail || last;
  }
  return { ok: false, detail: last };
}
