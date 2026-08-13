export type DemoState =
  | "normal"
  | "loading"
  | "empty"
  | "error"
  | "change-request"
  | "canceled";

export type DemoSearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export function resolveDemoState<const TAllowed extends readonly DemoState[]>(
  value: string | string[] | undefined,
  allowed: TAllowed,
): TAllowed[number] {
  const candidate = Array.isArray(value) ? value[0] : value;

  return (allowed.includes(candidate as DemoState) ? candidate : "normal") as
    TAllowed[number];
}
