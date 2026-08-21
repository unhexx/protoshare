# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-08-21

First published release. Two npm packages: `protoshare` (CLI) and `@protoshare/overlay`. Internal workspace packages stay unpublished.

### Added

- Snapshot gallery for local Storybook, Vite, and Next.js (`npx protoshare`)
- Optional public URL of the **gallery** via zrok, then cloudflared (`--live` / `--no-live`)
- Frozen share: `--pack` writes `gallery.tgz`; `--upload-url` or `PROTOSHARE_S3_*` PUT
- Catalog: `list`, `list --json`, `rm --files` / `--no-files`, `open --live` / `--no-live`
- Overlay Share button for Vite, Storybook (preview + manager toolbar), and Next
- Clipboard, browser-open, and terminal QR (`--qr` / `--no-qr`; `uqr` is bundled into the CLI, not a published package)
- Chromium install hint: `npx --package=protoshare playwright install chromium`

### Security

- Watch sidecar CORS allowlist is loopback Origins only (`403 forbidden-origin` otherwise)

[0.1.0]: https://github.com/unhexx/protoshare/releases/tag/v0.1.0
