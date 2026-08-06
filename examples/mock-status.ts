export type ApplicationStatus =
  | 'PENDING_PAYMENT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'RECEIVING_PRODUCT'
  | 'PRODUCT_RECEIVED'
  | 'IN_PRODUCTION'
  | 'QUALITY_CHECK'
  | 'SHIPPED'
  | 'COMPLETED'
  | 'ADDITIONAL_REVIEW_REQUIRED'
  | 'AUTHENTICITY_REVIEW_REQUIRED'
  | 'PRODUCTION_UNAVAILABLE'
  | 'CANCELED';

const FAST_DEMO_STEPS = [
  { afterSeconds: 0, status: 'APPROVED' },
  { afterSeconds: 5, status: 'RECEIVING_PRODUCT' },
  { afterSeconds: 10, status: 'PRODUCT_RECEIVED' },
  { afterSeconds: 20, status: 'IN_PRODUCTION' },
  { afterSeconds: 35, status: 'QUALITY_CHECK' },
  { afterSeconds: 50, status: 'SHIPPED' },
  { afterSeconds: 65, status: 'COMPLETED' },
] as const satisfies ReadonlyArray<{
  afterSeconds: number;
  status: ApplicationStatus;
}>;

export function resolveMockStatus(
  approvedAt: Date,
  now: Date = new Date(),
): ApplicationStatus {
  const elapsedSeconds = Math.max(
    0,
    (now.getTime() - approvedAt.getTime()) / 1000,
  );

  const step = [...FAST_DEMO_STEPS]
    .reverse()
    .find(({ afterSeconds }) => elapsedSeconds >= afterSeconds);

  return step?.status ?? 'APPROVED';
}

export function resolveEffectiveStatus(input: {
  persistedStatus: ApplicationStatus;
  statusOverride: ApplicationStatus | null;
  approvedAt: Date | null;
  progressProfile: 'FAST_DEMO' | 'STATIC';
  now?: Date;
}): ApplicationStatus {
  if (input.statusOverride) return input.statusOverride;
  if (!input.approvedAt || input.progressProfile === 'STATIC') {
    return input.persistedStatus;
  }
  return resolveMockStatus(input.approvedAt, input.now);
}
