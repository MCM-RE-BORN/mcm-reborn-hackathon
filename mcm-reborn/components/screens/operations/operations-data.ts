import {
  APPLICATION_LIFECYCLE_SEQUENCE,
  getNextApplicationLifecycleStatus,
  type ApplicationLifecycleStatus,
} from "@/data/application-lifecycle";
import { DEMO_SCENARIO } from "@/data/demo-scenario";

export const OPERATION_STATUSES = [
  "PENDING_PAYMENT",
  ...APPLICATION_LIFECYCLE_SEQUENCE,
  "CHANGE_APPROVAL_REQUIRED",
  "PRODUCTION_UNAVAILABLE",
  "CANCELED",
] as const;

export type OperationStatus = (typeof OPERATION_STATUSES)[number];

type StagePresentation = {
  description: string;
  label: string;
  owner: "관리자" | "장인";
};

export const OPERATION_STAGE_PRESENTATION: Record<
  OperationStatus,
  StagePresentation
> = {
  PENDING_PAYMENT: {
    description: "결제가 완료되면 수거 일정을 확정할 수 있습니다.",
    label: "결제 대기",
    owner: "관리자",
  },
  ORDER_PLACED: {
    description: "Mock 결제가 완료되어 수거 일정을 확정할 수 있습니다.",
    label: "신청 접수",
    owner: "관리자",
  },
  PICKUP_SCHEDULED: {
    description: "고객과 확정한 일정에 맞춰 수거를 준비합니다.",
    label: "수거 예정",
    owner: "관리자",
  },
  PICKUP_IN_PROGRESS: {
    description: "원제품이 아틀리에로 이동하고 있습니다.",
    label: "수거 중",
    owner: "관리자",
  },
  PRODUCT_RECEIVED: {
    description: "원제품 입고가 확인되어 실물 검수를 시작할 수 있습니다.",
    label: "제품 입고",
    owner: "장인",
  },
  EXPERT_INSPECTION: {
    description: "장인이 원단 상태와 제작 가능 범위를 확인하고 있습니다.",
    label: "실물 검수",
    owner: "장인",
  },
  PRODUCTION_READY: {
    description: "변경 조건에 대한 고객 승인이 반영되어 제작 준비가 끝났습니다.",
    label: "제작 준비",
    owner: "장인",
  },
  IN_PRODUCTION: {
    description: "승인된 조건에 따라 제품을 제작하고 있습니다.",
    label: "제작 중",
    owner: "장인",
  },
  QUALITY_CHECK: {
    description: "완성 제품의 마감과 최종 재사용률을 확인합니다.",
    label: "품질 확인",
    owner: "장인",
  },
  SHIPPED: {
    description: "품질 확인을 마친 완성 제품이 배송 중입니다.",
    label: "배송 중",
    owner: "관리자",
  },
  DELIVERED: {
    description: "고객 배송이 완료되어 신청을 마감할 수 있습니다.",
    label: "배송 완료",
    owner: "관리자",
  },
  COMPLETED: {
    description: "모든 공정이 끝나 디지털 ESG Passport가 발급되었습니다.",
    label: "완료",
    owner: "관리자",
  },
  CHANGE_APPROVAL_REQUIRED: {
    description: "실물 검수로 변경된 조건에 대한 고객 승인을 기다립니다.",
    label: "고객 승인 대기",
    owner: "관리자",
  },
  PRODUCTION_UNAVAILABLE: {
    description: "실물 검수 결과 제작을 진행할 수 없습니다.",
    label: "제작 불가",
    owner: "장인",
  },
  CANCELED: {
    description: "제작 불가 또는 조건 미승인으로 신청이 취소되었습니다.",
    label: "취소",
    owner: "관리자",
  },
};

type OperationTransition = {
  label: string;
  mode: "inspection-api" | "lifecycle-command";
  note: string;
};

const NEXT_TRANSITIONS: Partial<
  Record<OperationStatus, OperationTransition>
> = {
  ORDER_PLACED: {
    label: "수거 일정 확정",
    mode: "lifecycle-command",
    note: "고객과 수거 일정을 확정합니다.",
  },
  PICKUP_SCHEDULED: {
    label: "수거 시작",
    mode: "lifecycle-command",
    note: "예약한 일정에 원제품 수거를 시작합니다.",
  },
  PICKUP_IN_PROGRESS: {
    label: "제품 입고 완료",
    mode: "lifecycle-command",
    note: "원제품의 아틀리에 입고를 확인합니다.",
  },
  PRODUCT_RECEIVED: {
    label: "실물 검수 시작",
    mode: "lifecycle-command",
    note: "입고된 원제품의 실물 검수를 시작합니다.",
  },
  EXPERT_INSPECTION: {
    label: "실물 검수 저장",
    mode: "inspection-api",
    note: "검수 결과를 저장하고 다음 제작 조건을 반영합니다.",
  },
  PRODUCTION_READY: {
    label: "제작 시작",
    mode: "lifecycle-command",
    note: "승인된 최종 조건으로 제작을 시작합니다.",
  },
  IN_PRODUCTION: {
    label: "제작 완료 · 품질 확인",
    mode: "lifecycle-command",
    note: "제작을 완료하고 품질 확인 단계로 이동합니다.",
  },
  QUALITY_CHECK: {
    label: "품질 확인 완료 · 배송 시작",
    mode: "lifecycle-command",
    note: "최종 품질 확인을 마치고 Mock 배송을 시작합니다.",
  },
  SHIPPED: {
    label: "배송 완료",
    mode: "lifecycle-command",
    note: "Mock 배송 완료를 반영합니다.",
  },
  DELIVERED: {
    label: "신청 완료",
    mode: "lifecycle-command",
    note: "모든 공정을 완료하고 보증서 발급 조건을 충족합니다.",
  },
  PRODUCTION_UNAVAILABLE: {
    label: "제작 불가 취소 처리",
    mode: "lifecycle-command",
    note: "제작 불가 신청을 취소하고 환불 접수 상태로 전환합니다.",
  },
};

export const OPERATION_APPLICATION = {
  analysis: DEMO_SCENARIO.analysis,
  applicationId: DEMO_SCENARIO.order.id,
  applicationNumber: DEMO_SCENARIO.order.number,
  certificate: DEMO_SCENARIO.certificate,
  customer: DEMO_SCENARIO.order.customer,
  expertInspection: DEMO_SCENARIO.expertInspection,
  orderedAt: DEMO_SCENARIO.order.orderedAt,
  pickupDateLabel: DEMO_SCENARIO.order.pickupDateLabel,
  pickupTimeLabel: DEMO_SCENARIO.order.pickupTimeLabel,
  product: DEMO_SCENARIO.selectedDesign,
  sourceProduct: DEMO_SCENARIO.sourceProduct,
} as const;

export function readOperationStatus(
  value: string | string[] | undefined,
): OperationStatus {
  const candidate = Array.isArray(value) ? value[0] : value;

  return OPERATION_STATUSES.includes(candidate as OperationStatus)
    ? (candidate as OperationStatus)
    : "ORDER_PLACED";
}

export function getNextOperationTransition(
  status: OperationStatus,
): (OperationTransition & { targetStatus: OperationStatus }) | null {
  const presentation = NEXT_TRANSITIONS[status];
  const targetStatus =
    status === "PRODUCTION_UNAVAILABLE"
      ? "CANCELED"
      : isLinearLifecycleStatus(status)
        ? getNextApplicationLifecycleStatus(status)
        : null;

  return presentation && targetStatus
    ? { ...presentation, targetStatus }
    : null;
}

export function isOperationApplication(applicationId: string) {
  return (
    applicationId === OPERATION_APPLICATION.applicationId ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      applicationId,
    )
  );
}

export function operationDetailHref(
  status: OperationStatus,
  applicationId: string = OPERATION_APPLICATION.applicationId,
) {
  return `/operations/${applicationId}?status=${status}`;
}

export function hasConfirmedInspection(status: OperationStatus) {
  return [
    "PRODUCTION_READY",
    "IN_PRODUCTION",
    "QUALITY_CHECK",
    "SHIPPED",
    "DELIVERED",
    "COMPLETED",
  ].includes(status);
}

function isLinearLifecycleStatus(
  status: OperationStatus,
): status is ApplicationLifecycleStatus {
  return (APPLICATION_LIFECYCLE_SEQUENCE as readonly string[]).includes(status);
}
