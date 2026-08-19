export type DemoState =
  | "normal"
  | "loading"
  | "empty"
  | "error"
  | "permission"
  | "locked"
  | "change-request"
  | "canceled";

export const ORDER_STAGES = [
  "pickup",
  "inspection",
  "change-required",
  "production-ready",
  "production",
  "quality",
  "shipping",
  "completed",
  "canceled",
] as const;

export type OrderStage = (typeof ORDER_STAGES)[number];

export const CANCELLATION_REASONS = [
  "change-rejected",
  "production-unavailable",
] as const;

export type CancellationReason = (typeof CANCELLATION_REASONS)[number];

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

export function resolveOrderStage(
  value: string | string[] | undefined,
): OrderStage {
  const candidate = Array.isArray(value) ? value[0] : value;

  return ORDER_STAGES.includes(candidate as OrderStage)
    ? (candidate as OrderStage)
    : "pickup";
}

export function resolveCancellationReason(
  value: string | string[] | undefined,
): CancellationReason {
  const candidate = Array.isArray(value) ? value[0] : value;

  return CANCELLATION_REASONS.includes(candidate as CancellationReason)
    ? (candidate as CancellationReason)
    : "change-rejected";
}
