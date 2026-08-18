import { ApplicationStatus } from '@/contracts/application';

/**
 * Mock timeline profile: FAST_DEMO
 * Each step transitions after a specific number of seconds from approvedAt
 */
const FAST_DEMO_STEPS: Array<{ afterSeconds: number; status: ApplicationStatus }> = [
  { afterSeconds: 0, status: 'APPROVED' },
  { afterSeconds: 5, status: 'RECEIVING_PRODUCT' },
  { afterSeconds: 10, status: 'PRODUCT_RECEIVED' },
  { afterSeconds: 20, status: 'IN_PRODUCTION' },
  { afterSeconds: 35, status: 'QUALITY_CHECK' },
  { afterSeconds: 50, status: 'SHIPPED' },
  { afterSeconds: 65, status: 'COMPLETED' },
];

/**
 * Calculate current mock status based on elapsed time since approval
 */
export function resolveMockStatus(
  approvedAt: Date,
  now: Date = new Date()
): ApplicationStatus {
  const elapsed = Math.max(0, (now.getTime() - approvedAt.getTime()) / 1000);

  // Find the latest step that has passed
  const step = [...FAST_DEMO_STEPS]
    .reverse()
    .find((s) => elapsed >= s.afterSeconds);

  return step?.status ?? 'APPROVED';
}

/**
 * Resolve effective status:
 * - If statusOverride exists (exception state), use it
 * - Otherwise, calculate based on approvedAt
 */
export function resolveEffectiveStatus(
  persistedStatus: ApplicationStatus,
  statusOverride: ApplicationStatus | null,
  approvedAt: Date | null
): ApplicationStatus {
  if (statusOverride) {
    return statusOverride;
  }

  if (approvedAt && persistedStatus === 'APPROVED') {
    return resolveMockStatus(approvedAt);
  }

  return persistedStatus;
}
