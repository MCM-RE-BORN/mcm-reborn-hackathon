export const APPLICATION_LIFECYCLE_SEQUENCE = [
  "ORDER_PLACED",
  "PICKUP_SCHEDULED",
  "PICKUP_IN_PROGRESS",
  "PRODUCT_RECEIVED",
  "EXPERT_INSPECTION",
  "PRODUCTION_READY",
  "IN_PRODUCTION",
  "QUALITY_CHECK",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
] as const;

export type ApplicationLifecycleStatus =
  (typeof APPLICATION_LIFECYCLE_SEQUENCE)[number];

export const LIFECYCLE_COMMAND_TARGETS = [
  "PICKUP_SCHEDULED",
  "PICKUP_IN_PROGRESS",
  "PRODUCT_RECEIVED",
  "EXPERT_INSPECTION",
  "IN_PRODUCTION",
  "QUALITY_CHECK",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
  "PRODUCTION_UNAVAILABLE",
  "CANCELED",
] as const;

export type LifecycleCommandTarget =
  (typeof LIFECYCLE_COMMAND_TARGETS)[number];

export function getNextApplicationLifecycleStatus(
  status: ApplicationLifecycleStatus,
): ApplicationLifecycleStatus | null {
  const currentIndex = APPLICATION_LIFECYCLE_SEQUENCE.indexOf(status);

  return APPLICATION_LIFECYCLE_SEQUENCE[currentIndex + 1] ?? null;
}

export function isLifecycleCommandTarget(
  value: string,
): value is LifecycleCommandTarget {
  return (LIFECYCLE_COMMAND_TARGETS as readonly string[]).includes(value);
}
