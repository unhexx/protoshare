declare module "react" {
  export function useEffect(
    effect: () => void | (() => void),
    deps?: unknown[],
  ): void;
  export function createElement(...args: unknown[]): unknown;
}
