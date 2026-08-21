# TASK_SPECIFICATION.md — protoshare

**Project:** protoshare  
**Version Target:** 0.1 (first published release)  
**Primary Goal:** Designer shares local Storybook/Vite/Next prototypes via snapshots and a share URL, without deploying.

## Business Objectives

- Share frozen snapshot galleries via public URLs without a full deploy.
- Capture snapshots of Storybook, Vite, Next.js, and design-system work.
- Keep the share path fast enough for design review loops.

## Scope

**In scope (v0.1):** detect local preview, Playwright snapshots, static gallery, local Hono URL, optional zrok/cloudflared tunnel of the **gallery**, overlay Share button, pack/upload, catalog `list`/`rm`/`open`, MIT + CHANGELOG + npm consumer README.  
**Out of scope:** general-purpose hosting, production app deploys, custom tunnel protocol, visual-regression CI, tunneling the live preview, publishing `@protoshare/core|capture|live|share-app`.

## Drift

The 2026-08-21 draft listed live tunnel, vanity URLs, and overlay as “later”. Those shipped on `main` before the first npm tag. Remaining v0.1 work is release hygiene (CI publish workflow, npm org, `v0.1.0` tag). `packages/*` is SSOT; do not reverse the stack. Internal packages are `"private": true`. Two published packages only: `protoshare` and `@protoshare/overlay`.

## Success Criteria

- `pnpm test` green.
- `pnpm protoshare --help` works.
- Against a local preview, CLI writes a gallery with at least one PNG and serves it on 127.0.0.1.
- Reviewer can open the gallery URL and see the snapshots.

All loop output must use strict JSON handoffs per `agentic_loop_template/HANDOFF_SCHEMA.md`.
