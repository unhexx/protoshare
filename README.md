# protoshare

Beautiful public URLs + snapshots for local Storybook, Vite, Next.js prototypes and design systems. Share live interactive design work without deploying.

Snapshots first: a reviewer can open the gallery even if your laptop sleeps. If `zrok`/`zrok2` or `cloudflared` is installed, protoshare also prints a public live URL (zrok first, then cloudflared); otherwise it stays on the local gallery (`--no-live` skips the tunnel).

## Quick start

```bash
# Node 20+, pnpm 10
npx pnpm@10 install
npx pnpm@10 --filter @protoshare/capture exec playwright install chromium

# Storybook / Vite / Next must already be running, or pass a URL
npx pnpm@10 protoshare
npx pnpm@10 protoshare http://127.0.0.1:6006
npx pnpm@10 protoshare http://127.0.0.1:5173 --no-open --pack
npx pnpm@10 protoshare http://127.0.0.1:6006 --slug checkout
npx pnpm@10 protoshare --watch
```

Writes `.protoshare/out/<slug>/index.html` + `shots/*.png` and serves a local gallery. `--pack` also writes `gallery.tgz` (frozen share you can send without a live tunnel). With zrok enabled, `--slug` also tries a vanity host (`https://<slug>.share.zrok.io`); if the name is taken, the share falls back to a random live URL.

```bash
npx pnpm@10 test
```

If `playwright install` dies on a SOCKS proxy, retry without it:

```bash
env -u HTTPS_PROXY -u HTTP_PROXY -u ALL_PROXY npx pnpm@10 --filter @protoshare/capture exec playwright install chromium
```

## Overlay (Vite / Storybook / Next)

Inject a Share button into the local preview. It POSTs to a sidecar (`http://127.0.0.1:4178/v1/share`); if nothing is listening, the button copies `npx protoshare <origin>`. Run `protoshare --watch` so the sidecar captures snapshots and returns a gallery URL (public zrok or cloudflared URL when available, otherwise local). `--no-live` skips the tunnel.

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

## Stack (v0.1)

TypeScript · pnpm workspaces · Hono · Playwright · citty. See `docs/superpowers/specs/2026-08-21-protoshare-stack-design.md`.
