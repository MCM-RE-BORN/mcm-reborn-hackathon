export const ANALYSIS_STATUSES = [
  'RECEIVED',
  'ANALYZING',
  'SUPPLEMENT_REQUIRED',
  'COMPLETED',
  'FAILED',
] as const;

export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export const APPLICATION_STATUSES = [
  'PENDING_PAYMENT',
  'ORDER_PLACED',
  'PICKUP_SCHEDULED',
  'PICKUP_IN_PROGRESS',
  'PRODUCT_RECEIVED',
  'EXPERT_INSPECTION',
  'PRODUCTION_READY',
  'CHANGE_APPROVAL_REQUIRED',
  'IN_PRODUCTION',
  'QUALITY_CHECK',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
  'PRODUCTION_UNAVAILABLE',
  'CANCELED',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const PAYMENT_SUCCESS_STATUS = 'ORDER_PLACED' as const;

export const PRIMARY_DEMO_ORDER = {
  scenarioKey: 'MCM_BACKPACK_CHANGE_APPROVED_20260817',
  orderId: '30000000-0000-4000-8000-000000000001',
  orderNumber: 'RB-20260817-0001',
} as const;

const ALLOWED_TRANSITIONS: Readonly<
  Partial<Record<ApplicationStatus, readonly ApplicationStatus[]>>
> = {
  PENDING_PAYMENT: ['ORDER_PLACED', 'CANCELED'],
  ORDER_PLACED: ['PICKUP_SCHEDULED', 'CANCELED'],
  PICKUP_SCHEDULED: ['PICKUP_IN_PROGRESS', 'CANCELED'],
  PICKUP_IN_PROGRESS: ['PRODUCT_RECEIVED', 'CANCELED'],
  PRODUCT_RECEIVED: ['EXPERT_INSPECTION', 'CANCELED'],
  EXPERT_INSPECTION: [
    'PRODUCTION_READY',
    'CHANGE_APPROVAL_REQUIRED',
    'PRODUCTION_UNAVAILABLE',
    'CANCELED',
  ],
  CHANGE_APPROVAL_REQUIRED: ['PRODUCTION_READY', 'CANCELED'],
  PRODUCTION_READY: ['IN_PRODUCTION', 'CANCELED'],
  IN_PRODUCTION: ['QUALITY_CHECK', 'PRODUCTION_UNAVAILABLE', 'CANCELED'],
  QUALITY_CHECK: ['SHIPPED', 'PRODUCTION_UNAVAILABLE', 'CANCELED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['COMPLETED'],
};

export function canTransitionApplicationStatus(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  return from === to || ALLOWED_TRANSITIONS[from]?.includes(to) === true;
}

export type ProductionGate = {
  currentStatus: ApplicationStatus;
  inspectionOutcome:
    | 'NO_CHANGE'
    | 'CHANGE_REQUIRED'
    | 'PRODUCTION_UNAVAILABLE'
    | null;
  changeRequestStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
};

export function canEnterProduction(input: ProductionGate): boolean {
  if (input.currentStatus !== 'PRODUCTION_READY') return false;
  if (input.inspectionOutcome === 'NO_CHANGE') return true;

  return (
    input.inspectionOutcome === 'CHANGE_REQUIRED' &&
    input.changeRequestStatus === 'APPROVED'
  );
}

export function assertProductionStartAllowed(input: ProductionGate): void {
  if (!canEnterProduction(input)) {
    throw new Error(
      'PRODUCTION_START_BLOCKED: physical inspection and changed-term approval are required',
    );
  }
}
