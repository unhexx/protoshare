# protoshare

Frozen snapshot galleries for local Storybook, Vite, and Next.js. Share a review URL without deploying — a reviewer can open the gallery even if your laptop sleeps.

Live tunnels are optional and always front **the gallery**, not the live preview. When the CLI process exits, the live URL dies. What survives is the files on disk, `gallery.tgz`, or an S3/R2 object.

## Packages

Two packages are published:

| Package | Role |
|---|---|
| [`protoshare`](https://www.npmjs.com/package/protoshare) | CLI bin (`npx protoshare`) |
| [`@protoshare/overlay`](https://www.npmjs.com/package/@protoshare/overlay) | Share button for Vite / Storybook / Next |

Workspace packages `@protoshare/core`, `@protoshare/capture`, `@protoshare/live`, and `@protoshare/share-app` are private and bundled into the CLI. Terminal QR uses [`uqr`](https://github.com/unjs/uqr) bundled the same way — it is not a third published package.

## Install

Node 20+. Playwright does not download a browser on `npm install`. After the CLI is available:

```bash
npx protoshare --help
npx --package=protoshare playwright install chromium
npm i -D @protoshare/overlay
```

## Quick start

Storybook / Vite / Next must already be running, or pass a URL.

```bash
npx protoshare
npx protoshare http://127.0.0.1:6006
npx protoshare http://127.0.0.1:5173 --no-open --pack
npx protoshare http://127.0.0.1:6006 --slug checkout
npx protoshare --watch
npx protoshare list
npx protoshare list --json
npx protoshare rm checkout
npx protoshare rm checkout --no-files
npx protoshare open checkout
npx protoshare open checkout --no-live
```

Writes `.protoshare/out/<slug>/index.html` + `shots/*.png` and serves a local gallery on `127.0.0.1:4177`. The **session** URL (live tunnel if one came up, otherwise the gallery) is copied, opened in the browser, and printed as a terminal QR (`--no-copy` / `--no-browser` / `--no-qr` skip). `--watch` ignores `--copy` / `--browser` / `--qr` — the overlay owns that UX.

`--pack` also writes `gallery.tgz` (frozen share you can send without a live tunnel). `--upload-url` PUTs that archive to a presigned S3/R2 URL (`PROTOSHARE_UPLOAD_URL`); or set `PROTOSHARE_S3_ENDPOINT` + `PROTOSHARE_S3_BUCKET` + `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` for SigV4 PUT. `--public-url` / `PROTOSHARE_PUBLIC_URL` is what we print.

Each share is recorded in libsql (`PROTOSHARE_LIBSQL_URL` / `TURSO_DATABASE_URL`, default `file:.protoshare/shares.db`). The catalog prefers a **durable** URL (uploaded object, then live, then local gallery). A `local` mark in `protoshare list` means `.protoshare/out/<slug>` still exists on this machine — that local gallery URL is not sendable.

`protoshare open <slug>` serves `.protoshare/out/<slug>` again and tries a public zrok/cloudflared URL of that gallery (`--live` is the default; `--no-live` stays local). `open` does **not** write the catalog.

`protoshare rm <slug>` removes the catalog row and, by default, deletes `.protoshare/out/<slug>` (`--files`). `--no-files` keeps snapshots. Never deletes S3 objects. Slugs are path-guarded: empty / non-alnum names and any resolve that would escape the output root (`..`, absolute relative) are rejected.

With zrok enabled, `--slug` also tries a vanity host (`https://<slug>.share.zrok.io`); if the name is taken, the share falls back to a random live URL.

Scripts and CI: `--no-open --no-copy --no-browser --no-qr`.

## Overlay (Vite / Storybook / Next)

Inject a Share button into the local preview. It POSTs to a sidecar (`http://127.0.0.1:4178/v1/share`); if nothing is listening, the button copies `npx protoshare <origin>`. Run `protoshare --watch` so the sidecar captures snapshots and returns a gallery URL (public zrok or cloudflared URL when available, otherwise local). `--no-live` skips the tunnel.

The sidecar allows CORS only from **loopback** Origins (`http://127.0.0.1`, `http://localhost`, `http://[::1]`, any port). Missing, public, or LAN Origins get `403 forbidden-origin`. A preview opened at `http://192.168.x.x:<port>` cannot drive the Share button — open it at `http://127.0.0.1:<port>` instead.

```ts
// vite.config.ts
import { protoshareOverlay } from "@protoshare/overlay/vite";
export default { plugins: [protoshareOverlay()] };
```

```ts
// .storybook/main.ts
addons: ["@protoshare/overlay/storybook"];
```

The Storybook preset injects the preview overlay and a manager toolbar Share button (same sidecar protocol).

```tsx
// app/layout.tsx (Next.js)
import Script from "next/script";
import { protoshareScriptProps } from "@protoshare/overlay/next";
<Script {...protoshareScriptProps()} />
// or: import { ProtoshareOverlay } from "@protoshare/overlay/next";
```

## Develop (this repo)

```bash
# Node 20+, pnpm 10
npx pnpm@10 install
npx pnpm@10 --filter @protoshare/capture exec playwright install chromium
npx pnpm@10 build   # packages/cli/dist/main.js — npm bin `protoshare`
npx pnpm@10 test
npx pnpm@10 protoshare http://127.0.0.1:6006 --no-open
```

If `playwright install` dies on a SOCKS proxy, retry without it:

```bash
env -u HTTPS_PROXY -u HTTP_PROXY -u ALL_PROXY npx pnpm@10 --filter @protoshare/capture exec playwright install chromium
```

TypeScript · pnpm workspaces · Hono · Playwright · citty. See `docs/superpowers/specs/2026-08-21-protoshare-stack-design.md`.

## License

[MIT](LICENSE)
