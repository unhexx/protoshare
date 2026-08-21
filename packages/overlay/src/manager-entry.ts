import { createShareButtonRender, registerShareAddon } from "./manager.ts";

type ManagerMod = {
  addons: Parameters<typeof registerShareAddon>[0];
  types: Parameters<typeof registerShareAddon>[1];
};

async function loadManagerApi(): Promise<ManagerMod | null> {
  try {
    return (await import("storybook/manager-api")) as ManagerMod;
  } catch {
    try {
      return (await import("@storybook/manager-api")) as ManagerMod;
    } catch {
      return null;
    }
  }
}

function createElement(
  type: string,
  props: Record<string, unknown> | null,
  ...children: unknown[]
): unknown {
  const React = (globalThis as {
    React?: {
      createElement: (
        type: string,
        props: Record<string, unknown> | null,
        ...children: unknown[]
      ) => unknown;
    };
  }).React;
  if (React?.createElement) return React.createElement(type, props, ...children);
  return { type, props, children };
}

void loadManagerApi().then((mod) => {
  if (!mod) return;
  registerShareAddon(
    mod.addons,
    mod.types,
    createShareButtonRender({
      createElement,
      getOrigin: () => globalThis.location?.origin ?? "http://127.0.0.1:6006",
      getTitle: () => globalThis.document?.title,
      clipboardWrite: async (text) => {
        await navigator.clipboard.writeText(text);
      },
    }),
  );
});
