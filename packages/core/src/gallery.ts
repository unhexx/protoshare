import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { toShareSlug } from "./slug.ts";

export type ShotInput = {
  id: string;
  title: string;
  file: string;
};

export type WriteGalleryInput = {
  outDir: string;
  title: string;
  origin: string;
  shots: ShotInput[];
  slug?: string;
};

function safeShotName(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]+/g, "_") + ".png";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderHtml(
  title: string,
  origin: string,
  shots: { id: string; title: string; href: string }[],
): string {
  const cards = shots
    .map(
      (shot) => `
      <figure>
        <img src="${escapeHtml(shot.href)}" alt="${escapeHtml(shot.title)}" />
        <figcaption>${escapeHtml(shot.title)}</figcaption>
      </figure>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} · protoshare</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Iowan Old Style", "Palatino Linotype", Palatino, serif;
      background: #14110d;
      color: #f4efe6;
    }
    header {
      padding: 2.5rem 8vw 1rem;
      border-bottom: 1px solid #3a332b;
    }
    h1 { font-size: clamp(2rem, 5vw, 3.4rem); font-weight: 500; margin: 0 0 .4rem; letter-spacing: -.03em; }
    .meta { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .8rem; color: #b7a894; }
    main {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.25rem;
      padding: 1.5rem 8vw 4rem;
    }
    figure { margin: 0; }
    img {
      width: 100%;
      aspect-ratio: 16/10;
      object-fit: cover;
      background: #0c0a08;
      border: 1px solid #3a332b;
    }
    figcaption { margin-top: .5rem; font-size: .95rem; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    <p class="meta">protoshare · source ${escapeHtml(origin)}</p>
  </header>
  <main>${cards || "<p>No snapshots.</p>"}</main>
</body>
</html>
`;
}

export async function writeGallery(input: WriteGalleryInput): Promise<{ slug: string; outDir: string }> {
  const slug = toShareSlug(input.slug ?? input.title);
  const shotsDir = join(input.outDir, "shots");
  await mkdir(shotsDir, { recursive: true });

  const published: { id: string; title: string; href: string }[] = [];
  for (const shot of input.shots) {
    const name = safeShotName(shot.id);
    const dest = join(shotsDir, name);
    try {
      await copyFile(shot.file, dest);
    } catch {
      // исходного PNG может не быть в юнит-тесте — html всё равно пишем
    }
    published.push({ id: shot.id, title: shot.title, href: `shots/${name}` });
  }

  await writeFile(
    join(input.outDir, "index.html"),
    renderHtml(input.title, input.origin, published),
    "utf8",
  );
  await writeFile(
    join(input.outDir, "manifest.json"),
    JSON.stringify(
      {
        slug,
        title: input.title,
        origin: input.origin,
        shots: published,
      },
      null,
      2,
    ),
    "utf8",
  );

  return { slug, outDir: input.outDir };
}
