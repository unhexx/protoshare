# AGENTS

protoshare — snapshots-first share for local Storybook / Vite / Next.

## Context hygiene

```bash
python agentic_loop_template/tools/select.py --intent git|test|memory|state|bootstrap
python -m memory.state snapshot --window 3   # from agentic_loop_template, PYTHONPATH set
```

Do not paste `TOOLS_REGISTRY.md` or `DEVELOPMENT_STANDARDS.md` wholesale.

## Optional token harness

pxpipe is not on PATH by default. Dev-only:

```bash
npx pxpipe-proxy
# Grok is opt-in; hex/IDs must stay text
PXPIPE_MODELS=grok-4.6 npx pxpipe-proxy
```

Headroom (tool-output compression, less lossy than vision): `headroom wrap grok-build` if installed.

## Product commands

```bash
pnpm test
pnpm protoshare --help
pnpm protoshare http://127.0.0.1:6006 --no-open
```
