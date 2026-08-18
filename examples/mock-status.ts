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

export const LIFECYCLE_COMMAND_TARGET_STATUSES = [
  'PICKUP_SCHEDULED',
  'PICKUP_IN_PROGRESS',
  'PRODUCT_RECEIVED',
  'EXPERT_INSPECTION',
  'IN_PRODUCTION',
  'QUALITY_CHECK',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
  'PRODUCTION_UNAVAILABLE',
  'CANCELED',
] as const satisfies readonly ApplicationStatus[];

export type LifecycleCommandTargetStatus =
  (typeof LIFECYCLE_COMMAND_TARGET_STATUSES)[number];

type LifecycleCommandCommon = {
  note?: string;
};

export type ApplicationLifecycleCommand = LifecycleCommandCommon &
  (
    | {
        targetStatus: 'SHIPPED';
        trackingNumber: string;
        carrierCode?: string;
        carrierName?: string;
      }
    | {
        targetStatus: Exclude<LifecycleCommandTargetStatus, 'SHIPPED'>;
        trackingNumber?: never;
        carrierCode?: never;
        carrierName?: never;
      }
  );

export const PAYMENT_SUCCESS_STATUS = 'ORDER_PLACED' as const;

export const PRIMARY_DEMO_ORDER = {
  scenarioKey: 'MCM_BACKPACK_CHANGE_APPROVED_20260817',
  orderId: '30000000-0000-4000-8000-000000000001',
  orderNumber: 'RB-20260817-0001',
  pickupSchedule: {
    requestedDate: '2026-08-19',
    timeWindow: '14:00-16:00',
  },
  consents: {
    serviceAndPrivacyTermsAccepted: true,
    aiEstimateNoticeAccepted: true,
    inspectionChangeNoticeAccepted: true,
  },
} as const;

export const PRIMARY_DEMO_SHIPMENT = {
  applicationId: PRIMARY_DEMO_ORDER.orderId,
  carrierCode: 'MCM_REBORN_DEMO',
  carrierName: 'MCM RE:BORN Demo Logistics',
  trackingNumber: 'DEMO-RB-20260817-0001',
  trackingUrl: null,
  status: 'DELIVERED',
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
  PRODUCTION_UNAVAILABLE: ['CANCELED'],
};

const LIFECYCLE_COMMAND_TRANSITIONS: Readonly<
  Partial<Record<ApplicationStatus, readonly LifecycleCommandTargetStatus[]>>
> = {
  ORDER_PLACED: ['PICKUP_SCHEDULED'],
  PICKUP_SCHEDULED: ['PICKUP_IN_PROGRESS'],
  PICKUP_IN_PROGRESS: ['PRODUCT_RECEIVED'],
  PRODUCT_RECEIVED: ['EXPERT_INSPECTION'],
  PRODUCTION_READY: ['IN_PRODUCTION'],
  IN_PRODUCTION: ['QUALITY_CHECK', 'PRODUCTION_UNAVAILABLE'],
  QUALITY_CHECK: ['SHIPPED', 'PRODUCTION_UNAVAILABLE'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['COMPLETED'],
  PRODUCTION_UNAVAILABLE: ['CANCELED'],
};

export function canAdvanceApplicationLifecycle(
  from: ApplicationStatus,
  target: LifecycleCommandTargetStatus,
): boolean {
  return LIFECYCLE_COMMAND_TRANSITIONS[from]?.includes(target) === true;
}

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
