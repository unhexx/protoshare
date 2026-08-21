declare module "storybook/manager-api" {
  export const addons: {
    register: (id: string, cb: () => void) => void;
    add: (id: string, descriptor: Record<string, unknown>) => void;
  };
  export const types: { TOOL: string };
}

declare module "@storybook/manager-api" {
  export const addons: {
    register: (id: string, cb: () => void) => void;
    add: (id: string, descriptor: Record<string, unknown>) => void;
  };
  export const types: { TOOL: string };
}
