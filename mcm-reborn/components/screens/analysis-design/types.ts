export type DemoState =
  | "normal"
  | "loading"
  | "empty"
  | "error"
  | "limited"
  | "canceled";

export type RecommendationCategory = "wallet" | "pouch" | "keyring";

const DEMO_STATES: DemoState[] = [
  "normal",
  "loading",
  "empty",
  "error",
  "limited",
  "canceled",
];

const RECOMMENDATION_CATEGORIES: RecommendationCategory[] = [
  "wallet",
  "pouch",
  "keyring",
];

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function readDemoState(
  value: string | string[] | undefined,
): DemoState {
  const candidate = firstValue(value);

  return DEMO_STATES.includes(candidate as DemoState)
    ? (candidate as DemoState)
    : "normal";
}

export function readRecommendationCategory(
  value: string | string[] | undefined,
): RecommendationCategory {
  const candidate = firstValue(value);

  return RECOMMENDATION_CATEGORIES.includes(
    candidate as RecommendationCategory,
  )
    ? (candidate as RecommendationCategory)
    : "wallet";
}

