import {
  APPLICATION_LIFECYCLE_SEQUENCE,
  getNextApplicationLifecycleStatus,
  type ApplicationLifecycleStatus,
} from "@/data/application-lifecycle";
import { DEMO_SCENARIO } from "@/data/demo-scenario";

export const OPERATION_STATUSES = APPLICATION_LIFECYCLE_SEQUENCE;

export type OperationStatus = ApplicationLifecycleStatus;

type StagePresentation = {
  description: string;
  label: string;
  owner: "관리자" | "장인";
};

export const OPERATION_STAGE_PRESENTATION: Record<
  OperationStatus,
  StagePresentation
> = {
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
};

type OperationTransition = {
  label: string;
  mode: "inspection-fixture" | "lifecycle-command";
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
    label: "검수 완료 · 제작 준비",
    mode: "inspection-fixture",
    note: "중앙 데모의 변경 조건과 고객 승인 결과를 반영합니다.",
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
};

export const OPERATION_APPLICATION = {
  analysis: DEMO_SCENARIO.analysis,
  applicationId: DEMO_SCENARIO.order.id,
  applicationNumber: DEMO_SCENARIO.order.number,
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

export function getNextOperationTransition(status: OperationStatus) {
  const presentation = NEXT_TRANSITIONS[status];
  const targetStatus = getNextApplicationLifecycleStatus(status);

  return presentation && targetStatus
    ? { ...presentation, targetStatus }
    : null;
}

export function isOperationApplication(applicationId: string) {
  return applicationId === OPERATION_APPLICATION.applicationId;
}

export function operationDetailHref(status: OperationStatus) {
  return `/operations/${OPERATION_APPLICATION.applicationId}?status=${status}`;
}
