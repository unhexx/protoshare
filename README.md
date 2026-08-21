# protoshare

Beautiful public URLs + snapshots for local Storybook, Vite, Next.js prototypes and design systems. Share live interactive design work without deploying.

Snapshots first: a reviewer can open the gallery even if your laptop sleeps. If `zrok` or `zrok2` is installed and enabled, protoshare also prints a public live URL; otherwise it stays on the local gallery (`--no-live` skips the tunnel).

## Quick start

```bash
# Node 20+, pnpm 10
npx pnpm@10 install
npx pnpm@10 --filter @protoshare/capture exec playwright install chromium

# Storybook / Vite / Next must already be running, or pass a URL
npx pnpm@10 protoshare
npx pnpm@10 protoshare http://127.0.0.1:6006
npx pnpm@10 protoshare http://127.0.0.1:5173 --no-open
```

Writes `.protoshare/out/<id>/index.html` + `shots/*.png` and serves a local gallery.

```bash
npx pnpm@10 test
```

If `playwright install` dies on a SOCKS proxy, retry without it:

```bash
env -u HTTPS_PROXY -u HTTP_PROXY -u ALL_PROXY npx pnpm@10 --filter @protoshare/capture exec playwright install chromium
```

## Stack (v0.1)

TypeScript · pnpm workspaces · Hono · Playwright · citty. See `docs/superpowers/specs/2026-08-21-protoshare-stack-design.md`.
