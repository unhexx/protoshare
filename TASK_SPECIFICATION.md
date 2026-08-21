# TASK_SPECIFICATION.md — protoshare

**Project:** protoshare  
**Version Target:** 0.1 (frozen share)  
**Primary Goal:** Designer shares local Storybook/Vite/Next prototypes via snapshots and a share URL, without deploying.

## Business Objectives

- Share live local prototypes via public URLs without a full deploy.
- Capture snapshots of Storybook, Vite, Next.js, and design-system work.
- Keep the share path fast enough for design review loops.

## Scope

**In scope (v0.1):** detect local preview, Playwright snapshots, static gallery, local Hono URL.  
**In scope (later):** zrok live tunnel, vanity URLs, Storybook addon, Vite overlay.  
**Out of scope:** general-purpose hosting, production app deploys, custom tunnel protocol, visual-regression CI.

## Success Criteria

- `pnpm test` green.
- `pnpm protoshare --help` works.
- Against a local preview, CLI writes a gallery with at least one PNG and serves it on 127.0.0.1.
- Reviewer can open the gallery URL and see the snapshots.

All loop output must use strict JSON handoffs per `agentic_loop_template/HANDOFF_SCHEMA.md`.
