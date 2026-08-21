# PROJECT_CONTEXT.md

> Source of Truth: `TASK_SPECIFICATION.md`

## Project Identification

| Parameter | Value |
|-----------|-------|
| **Project** | protoshare |
| **Goal** | Snapshots-first share for local Storybook/Vite/Next |
| **Tech Stack** | TypeScript, pnpm, Hono, Playwright, citty (zrok then cloudflared) |
| **Current Branch** | main |
| **Template** | agentic_loop_template 3.5.1 (includes `tools/`) |

## Current Status

| Field | Value |
|-------|-------|
| **Cycle Number** | 1 |
| **Current Phase** | v0.1-publish |
| **Status** | IN_PROGRESS |
| **Confidence** | 0.9 |

## Drift

Product surface is on `main` (frozen gallery + live adapter + overlay + catalog). Live tunnels the gallery, not the preview. Two published packages: `protoshare`, `@protoshare/overlay`. Internals are `"private": true`. MIT LICENSE, Keep a Changelog `## [0.1.0] - 2026-08-21`. Remaining: release workflow + tag.

## Key Decisions

- Approach A: snapshots-first TypeScript open-core. Live tunnel is an adapter, not the product.
- Do not invent a tunnel protocol. zrok (Apache-2) then cloudflared.
- Product language is TypeScript (`npx protoshare`). Python stays in the agentic template only.
- Phase 1 gallery is generated HTML served by Hono — no React app until vanity URLs.
- Load tools via `python agentic_loop_template/tools/select.py --intent …`. Never paste TOOLS_REGISTRY.
- pxpipe / Headroom are optional dev harness, not runtime deps.

## Permanent Rules

- Advance unfinished items from `.agent/PLAN.md` + `.agent/TODO.md` only.
- Git self-cycle §11 before planning.
- Load tools via `python agentic_loop_template/tools/select.py --intent …`, never paste full TOOLS_REGISTRY.
