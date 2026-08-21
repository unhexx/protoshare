import { DEFAULT_SIDECAR, DEFAULT_SHARE_TIMEOUT_MS, shareEndpoint } from "./share.ts";

export type OverlayClientOpts = {
  sidecarOrigin?: string;
};

/** IIFE для preview: кнопка Share, POST на сайдкар, иначе копирует CLI. */
export function overlayClientSource(opts: OverlayClientOpts = {}): string {
  const sidecar = opts.sidecarOrigin ?? DEFAULT_SIDECAR;
  const endpoint = shareEndpoint(sidecar);
  const timeoutMs = DEFAULT_SHARE_TIMEOUT_MS;
  return `(() => {
  if (window.__protoshareOverlay) return;
  window.__protoshareOverlay = true;
  const endpoint = ${JSON.stringify(endpoint)};
  const timeoutMs = ${timeoutMs};
  const root = document.createElement("div");
  root.id = "protoshare-overlay";
  root.setAttribute("data-protoshare", "overlay");
  root.innerHTML = '<button type="button" data-protoshare="share">Share</button><span data-protoshare="status" hidden></span>';
  root.style.cssText = "position:fixed;bottom:16px;right:16px;z-index:2147483646;display:flex;gap:8px;align-items:center;font:14px/1.3 ui-sans-serif,system-ui,sans-serif";
  const btn = root.querySelector("[data-protoshare=share]");
  const status = root.querySelector("[data-protoshare=status]");
  if (btn) {
    btn.style.cssText = "appearance:none;border:1px solid #3a332b;background:#14110d;color:#f4efe6;padding:.45rem .8rem;cursor:pointer";
  }
  if (status) status.style.cssText = "color:#b7a894;max-width:22rem";
  const show = (text) => {
    if (!status) return;
    status.hidden = false;
    status.textContent = text;
  };
  btn?.addEventListener("click", async () => {
    const origin = location.origin;
    const command = "npx protoshare " + origin;
    show("Capturing…");
    const params = new URLSearchParams(location.search);
    let storyId = params.get("id") || undefined;
    if (!storyId) {
      const path = params.get("path");
      if (path) {
        const marker = "/story/";
        const idx = path.indexOf(marker);
        const raw = idx >= 0 ? path.slice(idx + marker.length) : path;
        storyId = raw.split("/").join("-") || undefined;
      }
    }
    try {
      const ac = new AbortController();
      const timer = setTimeout(function () { ac.abort(); }, timeoutMs);
      let res;
      try {
        res = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ origin, title: document.title, storyId }),
          signal: ac.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (res.status === 409) {
        show("Share already in progress");
        return;
      }
      const data = res.ok ? await res.json() : null;
      if (data && typeof data.url === "string" && data.url) {
        try { await navigator.clipboard.writeText(data.url); } catch (e) {}
        if (typeof data.captured === "number" && typeof data.total === "number") {
          show("Captured " + data.captured + " / " + data.total + " stories");
        } else {
          show(data.url);
        }
        return;
      }
    } catch (e) {}
    try { await navigator.clipboard.writeText(command); } catch (e) {}
    show(command);
  });
  document.documentElement.appendChild(root);
})();`;
}
