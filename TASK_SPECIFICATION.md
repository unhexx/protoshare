# TASK_SPECIFICATION.md — protoshare

**Project:** protoshare
**Version Target:** 1.0
**Primary Goal:** Beautiful public URLs + snapshots for local Storybook, Vite, Next.js prototypes and design systems — share live interactive design work without deploying.

## Business Objectives

- Share live local prototypes via public URLs without a full deploy.
- Capture snapshots of Storybook, Vite, Next.js, and design-system work.
- Keep the share path fast enough for design review loops.

## Scope

**In scope:** public URL sharing, snapshots, local Storybook/Vite/Next.js/design-system prototypes.
**Out of scope:** general-purpose hosting, production app deploys.

## Success Criteria

- All INVEST tasks in `.agent/TODO.md` marked DONE with tests passing.
- Reviewer approves with `status=DONE` and clean git sync.

All loop output must use strict JSON handoffs per `agentic_loop_template/HANDOFF_SCHEMA.md`.
