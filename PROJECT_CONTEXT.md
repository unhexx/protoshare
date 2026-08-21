# PROJECT_CONTEXT.md

> Source of Truth: `TASK_SPECIFICATION.md`

## Project Identification

| Parameter | Value |
|-----------|-------|
| **Project** | protoshare |
| **Goal** | Beautiful public URLs + snapshots for local Storybook, Vite, Next.js prototypes and design systems |
| **Tech Stack** | TBD (Storybook / Vite / Next.js prototypes) |
| **Current Branch** | main |
| **Template** | agentic_loop_template 3.5.1 (includes `tools/`) |

## Current Status

| Field | Value |
|-------|-------|
| **Cycle Number** | 0 |
| **Current Phase** | bootstrap |
| **Status** | IN_PROGRESS |
| **Confidence** | 0.75 |

## Key Decisions

- Copied Agentix SSOT into `agentic_loop_template/` including progressive `tools/` blocks (`tools/select.py`).

## Permanent Rules

- Advance unfinished items from `.agent/PLAN.md` + `.agent/TODO.md` only.
- Git self-cycle §11 before planning.
- Load tools via `python agentic_loop_template/tools/select.py --intent …`, never paste full TOOLS_REGISTRY.
