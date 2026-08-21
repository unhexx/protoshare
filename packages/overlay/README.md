# @protoshare/overlay

Share button for local Storybook, Vite, and Next.js previews. Pairs with the [`protoshare`](https://www.npmjs.com/package/protoshare) CLI.

The button POSTs to a sidecar (`http://127.0.0.1:4178/v1/share`). If nothing is listening, it copies `npx protoshare <origin>`. Run `protoshare --watch` so the sidecar captures a **snapshot gallery** (optional public zrok/cloudflared URL of that gallery; `--no-live` stays local). The tunnel fronts the gallery, not the live preview.

## Install

```bash
npm i -D @protoshare/overlay
npx protoshare --watch
```

Playwright Chromium is a CLI extra, not this package:

```bash
npx --package=protoshare playwright install chromium
```

## CORS

The sidecar allows CORS only from **loopback** Origins (`http://127.0.0.1`, `http://localhost`, `http://[::1]`, any port). Missing, public, or LAN Origins get `403 forbidden-origin`. A preview opened at `http://192.168.x.x:<port>` cannot drive the Share button — open it at `http://127.0.0.1:<port>` instead.

## Vite

```ts
// vite.config.ts
import { protoshareOverlay } from "@protoshare/overlay/vite";
export default { plugins: [protoshareOverlay()] };
```

## Storybook

```ts
// .storybook/main.ts
addons: ["@protoshare/overlay/storybook"];
```

The preset injects the preview overlay and a manager toolbar Share button (same sidecar protocol).

## Next.js

```tsx
// app/layout.tsx
import Script from "next/script";
import { protoshareScriptProps } from "@protoshare/overlay/next";
<Script {...protoshareScriptProps()} />
// or: import { ProtoshareOverlay } from "@protoshare/overlay/next";
```

## License

[MIT](LICENSE)
