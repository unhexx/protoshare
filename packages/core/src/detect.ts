export type PreviewKind = "storybook" | "vite" | "next" | "static";

export type StoryRef = {
  id: string;
  title: string;
  name: string;
};

export type DetectedTarget = {
  kind: PreviewKind;
  origin: string;
  title?: string;
  stories: StoryRef[];
};

const FETCH_MS = 1500;

async function getText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_MS) });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function parseIndex(raw: string): Record<string, unknown> | null {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

export async function detectTarget(origin: string): Promise<DetectedTarget> {
  const base = origin.replace(/\/$/, "");
  const indexText = await getText(`${base}/index.json`);
  const index = indexText ? parseIndex(indexText) : null;
  const entries = index?.entries;

  if (entries && typeof entries === "object") {
    const stories: StoryRef[] = [];
    for (const value of Object.values(entries as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const entry = value as Record<string, unknown>;
      if (entry.type !== "story" || typeof entry.id !== "string") continue;
      stories.push({
        id: entry.id,
        title: typeof entry.title === "string" ? entry.title : "Story",
        name: typeof entry.name === "string" ? entry.name : entry.id,
      });
    }
    return {
      kind: "storybook",
      origin: base,
      title: stories[0]?.title ?? "Storybook",
      stories,
    };
  }

  const html = (await getText(base + "/")) ?? "";
  if (html.includes("/_next/") || html.includes("__NEXT_DATA__")) {
    return { kind: "next", origin: base, title: "Next.js", stories: [] };
  }
  if (html.includes("/@vite/client") || html.includes("vite/client")) {
    return { kind: "vite", origin: base, title: "Vite", stories: [] };
  }
  return { kind: "static", origin: base, title: "Preview", stories: [] };
}

const DEFAULT_PORTS = [6006, 5173, 3000, 4173];

async function probePort(port: number): Promise<DetectedTarget | null> {
  try {
    const target = await detectTarget(`http://127.0.0.1:${port}`);
    if (target.kind !== "static" || target.stories.length > 0) return target;
    // static тоже ок, если порт ответил HTML — detectTarget не отличает мёртвый порт
    // (fetch fail → static с пустым html). Проверяем, что origin живой:
    const probe = await getText(target.origin + "/");
    return probe !== null ? target : null;
  } catch {
    return null;
  }
}

/** Все живые локальные превьюеры на стандартных (или заданных) портах. */
export async function scanAllLocalPreviews(
  ports: number[] = DEFAULT_PORTS,
): Promise<DetectedTarget[]> {
  const found: DetectedTarget[] = [];
  for (const port of ports) {
    const target = await probePort(port);
    if (target) found.push(target);
  }
  return found;
}

/** Ищем живой локальный превьюер. */
export async function scanLocalPreviews(
  ports: number[] = DEFAULT_PORTS,
): Promise<DetectedTarget | null> {
  const all = await scanAllLocalPreviews(ports);
  return all[0] ?? null;
}
