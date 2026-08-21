# protoshare — stack & MVP design

**Date:** 2026-08-21  
**Status:** approved (plan A, snapshots-first)

## Problem

A designer running Storybook / Vite / Next locally needs a Figma-like share link for *code*: a beautiful public URL and frozen snapshots, without a production deploy. Live tunnel is secondary. Reviewer must still see the work if the author’s laptop sleeps.

## Non-goals (v1)

- Custom tunnel protocol (iroh/QUIC from scratch)
- Visual-regression SaaS (Argos already exists)
- Next.js as the product runtime
- Python as the product language
- Chromatic / Lost Pixel / MinIO dependencies

## Stack

- TypeScript, Node 20+, pnpm workspaces
- CLI: citty + @clack/prompts
- HTTP: Hono (`@hono/node-server`)
- Capture: Playwright
- Live (phase 2): zrok adapter, cloudflared fallback
- Storage (phase 3): S3 API (R2 hosted / SeaweedFS self-host)
- Metadata (phase 3): libsql + Drizzle
- Tooling: Vitest, tsx (dev), Biome later

Phase 1 gallery is a **generated static HTML** served by Hono. A React/Tailwind app is deferred until vanity URLs — it does not unblock user value.

## MVP behavior (phase 1)

```
protoshare                 # scan 6006, 5173, 3000, 4173
protoshare http://127.0.0.1:6006
protoshare --out .protoshare/out --no-open
```

1. Detect target:
   - Storybook if `GET {origin}/index.json` has `entries`
   - Vite if HTML contains `/@vite/client` or `type="module"`
   - Next if `/_next/` markers
   - Else `static`
2. Capture:
   - Storybook: each `type=story` via `{origin}/iframe.html?id={id}&viewMode=story`
   - Others: origin `/` at 1280×800
3. Write `{out}/{slug}/index.html` + `shots/*.png` + `manifest.json`
4. Serve on `127.0.0.1:4177` and print the URL

Success: a reviewer opens the local (or later public) URL and sees component snapshots without VPN.

## Agent harness

- Load tools via `python agentic_loop_template/tools/select.py --intent …` only
- Optional: `npx pxpipe-proxy` with `PXPIPE_MODELS` including grok-4.6 (lossy on hex — keep IDs as text)
- Optional: Headroom wrap for tool-output compression
- pxpipe is **dev-only**, not a product dependency

## Drift (v0.1 on disk)

Live adapters and overlay shipped before the first npm publish. Gallery remains generated HTML. Two published packages only (`protoshare`, `@protoshare/overlay`); `@protoshare/core|capture|live|share-app` are `"private": true`. MIT LICENSE at repo root and in the published package dirs. Keep a Changelog first version heading is `## [0.1.0] - 2026-08-21`. Consumer Chromium: `npx --package=protoshare playwright install chromium`. Do not treat this 2026-08-21 stack note as the CLI SSOT — see `packages/*`.
