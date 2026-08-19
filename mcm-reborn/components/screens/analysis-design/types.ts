import { firstValue } from "@/lib/search-params";

export type DemoState =
  | "normal"
  | "loading"
  | "empty"
  | "error"
  | "permission"
  | "limited"
  | "canceled";

const DEMO_STATES: DemoState[] = [
  "normal",
  "loading",
  "empty",
  "error",
  "permission",
  "limited",
  "canceled",
];

export function readDemoState(
  value: string | string[] | undefined,
): DemoState {
  const candidate = firstValue(value);

  return DEMO_STATES.includes(candidate as DemoState)
    ? (candidate as DemoState)
    : "normal";
}
