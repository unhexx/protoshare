export const OVERLAY_SCRIPT_SRC = "/@protoshare/overlay.js";

export function injectOverlay(
  html: string,
  scriptSrc: string = OVERLAY_SCRIPT_SRC,
): string {
  const tag = `<script src="${scriptSrc}"></script>`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${tag}</body>`);
  }
  return `${html}${tag}`;
}
