"use client";

import Image from "next/image";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { ActionButtonLink } from "@/components/ui/ActionButtonLink";
import { ButtonLink } from "@/components/ui/Button";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { ProgressStepper } from "@/components/ui/ProgressStepper";
import { SectionBand } from "@/components/ui/SectionBand";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { DEMO_SCENARIO, formatKrw } from "@/data/demo-scenario";
import type {
  CancellationReason,
  DemoState,
  OrderStage,
} from "./demo-state";
import { DemoStatePanel } from "./DemoStatePanel";
import {
  formatPickupDateLabel,
  formatPickupTimeLabel,
  useOrderDraft,
} from "./OrderDraftProvider";
import styles from "./order-certificate.module.css";

type OrderDetailsScreenProps = {
  cancellationReason: CancellationReason;
  stage: OrderStage;
  state: Extract<
    DemoState,
    "normal" | "loading" | "empty" | "error" | "permission"
  >;
};

type ActiveOrderStage = Exclude<OrderStage, "canceled">;

const PROGRESS_STEPS = [
  "접수",
  "검수",
  "제작중",
  "품질확인",
  "배송",
  "완료",
];

const STAGE_DETAILS: Record<
  ActiveOrderStage,
  {
    currentIndex: number;
    description: string;
    nextHref?: string;
    nextLabel?: string;
    title: string;
    tone: "permission" | "success";
  }
> = {
  pickup: {
    currentIndex: 0,
    description:
      "예약한 일정에 원본 가방을 수거합니다. 수거가 완료되면 전문가 실물 검수가 시작됩니다.",
    nextHref: "/orders/demo?stage=inspection",
    nextLabel: "수거 완료 · 실물 검수 보기",
    title: "수거를 기다리고 있어요",
    tone: "permission",
  },
  inspection: {
    currentIndex: 1,
    description:
      "전문가가 원단 상태와 손상 범위를 직접 확인해 최종 제작 조건을 점검하고 있어요.",
    nextHref: "/orders/demo?stage=change-required",
    nextLabel: "실물 검수 결과 확인하기",
    title: "전문가 실물 검수 중이에요",
    tone: "permission",
  },
  "change-required": {
    currentIndex: 1,
    description:
      "실물에서 추가 마모가 확인되어 재사용률, 제작 금액과 기간이 조정되었습니다.",
    title: "변경된 제작 조건을 확인해 주세요",
    tone: "permission",
  },
  production: {
    currentIndex: 2,
    description:
      "승인한 최종 조건에 따라 아틀리에에서 여권지갑을 제작하고 있어요.",
    nextHref: "/orders/demo?stage=quality",
    nextLabel: "제작 완료 · 품질 확인 보기",
    title: "장인 제작이 시작되었어요",
    tone: "success",
  },
  quality: {
    currentIndex: 3,
    description:
      "완성된 제품의 마감, 내구성과 최종 재사용 소재 비율을 확인하고 있어요.",
    nextHref: "/orders/demo?stage=shipping",
    nextLabel: "품질 확인 완료 · 배송 보기",
    title: "최종 품질을 확인하고 있어요",
    tone: "success",
  },
  shipping: {
    currentIndex: 4,
    description:
      "품질 확인을 마친 여권지갑이 안전하게 포장되어 배송 중이에요.",
    nextHref: "/orders/demo?stage=completed",
    nextLabel: "배송 완료 보기",
    title: "완성된 제품을 배송하고 있어요",
    tone: "success",
  },
  completed: {
    currentIndex: 5,
    description:
      "제작과 품질 확인, 배송이 모두 완료되어 디지털 ESG Passport가 발급되었습니다.",
    nextHref: "/certificates/demo?state=issued",
    nextLabel: "디지털 ESG Passport 보기",
    title: "RE:BORN 여정이 완료되었어요",
    tone: "success",
  },
};

const FINAL_TERM_STAGES: OrderStage[] = [
  "production",
  "quality",
  "shipping",
  "completed",
];

export function OrderDetailsScreen({
  cancellationReason,
  stage,
  state,
}: OrderDetailsScreenProps) {
  const { orderDraft } = useOrderDraft();
  const { analysis, expertInspection, order, selectedDesign } = DEMO_SCENARIO;
  const usesFinalTerms = FINAL_TERM_STAGES.includes(stage);
  const displayedPrice = usesFinalTerms
    ? expertInspection.revisedPriceKrw
    : selectedDesign.initialPriceKrw;
  const productionUnavailable =
    cancellationReason === "production-unavailable";

  return (
    <AppShell
      header={
        <PageHeader backHref={`/orders?stage=${stage}`} title="신청 내역" />
      }
    >
      {state !== "normal" ? (
        <div className={styles.stateInset}>
          <DemoStatePanel
            emptyDescription="아직 접수된 업사이클링 신청이 없습니다."
            retryHref="/orders/demo?stage=pickup"
            state={state}
            subject="신청 상세"
          />
        </div>
      ) : (
        <>
          {stage !== "canceled" ? (
            <>
              <Section title="현재 진행 안내">
                <StatusPanel
                  action={
                    STAGE_DETAILS[stage].nextHref &&
                    STAGE_DETAILS[stage].nextLabel ? (
                      <ButtonLink
                        fullWidth
                        href={STAGE_DETAILS[stage].nextHref}
                      >
                        {STAGE_DETAILS[stage].nextLabel}
                      </ButtonLink>
                    ) : undefined
                  }
                  description={STAGE_DETAILS[stage].description}
                  title={STAGE_DETAILS[stage].title}
                  tone={STAGE_DETAILS[stage].tone}
                />
                <KeyValueList
                  items={[
                    {
                      label: "수거 일정",
                      value: `${formatPickupDateLabel(orderDraft.pickupDate)} ${formatPickupTimeLabel(orderDraft.pickupTime)}`,
                    },
                    {
                      label: "예상 제작 기간",
                      value: usesFinalTerms
                        ? expertInspection.revisedDuration
                        : selectedDesign.initialEstimatedDuration,
                    },
                  ]}
                />
              </Section>
              <SectionBand />
            </>
          ) : null}

          <article
            aria-labelledby="order-product-name"
            className={styles.orderSummary}
          >
            <div className={styles.orderProductRow}>
              <div className={styles.productThumbnail}>
                <Image
                  alt={`${selectedDesign.name} 제품 이미지`}
                  fill
                  sizes="40px"
                  src="/assets/mvp-beta/figma-order-product.png"
                />
              </div>
              <div className={styles.orderProductCopy}>
                <h2 id="order-product-name">{selectedDesign.name}</h2>
                <p>신청일 {order.orderedAt}</p>
                <span>수량: 1개</span>
              </div>
              <strong>{formatKrw(displayedPrice)}</strong>
            </div>

            {stage !== "canceled" ? (
              <>
                <div className={styles.orderActionGrid}>
                  <button disabled type="button">
                    문의하기
                  </button>
                  <a href="#delivery-information">배송현황</a>
                </div>
                <ActionButtonLink
                  className={styles.orderCertificateAction}
                  fullWidth
                  href={`/certificates/demo?state=${
                    stage === "completed" ? "issued" : "locked"
                  }`}
                >
                  나의 RE:BORN 인증서 보기
                </ActionButtonLink>
              </>
            ) : null}
          </article>

          {stage === "canceled" ? (
            <>
              <SectionBand />
              <Section title="신청 취소">
                <StatusPanel
                  action={
                    <ButtonLink fullWidth href="/home">
                      홈으로 이동
                    </ButtonLink>
                  }
                  description={
                    productionUnavailable
                      ? "전문가 실물 검수 결과 안전한 제작이 어려워 신청이 취소되었습니다. 결제 승인 취소와 전액 환불이 접수되었습니다. 시연 환경에서는 실제 청구나 환불이 발생하지 않습니다."
                      : "변경된 제작 조건을 승인하지 않아 신청이 취소되었습니다. 결제 승인 취소와 전액 환불이 접수되었습니다. 시연 환경에서는 실제 청구나 환불이 발생하지 않습니다."
                  }
                  title="신청이 취소되었습니다"
                  tone="empty"
                />
                <KeyValueList
                  items={[
                    { label: "신청번호", value: order.number },
                    {
                      label: "취소 사유",
                      value: productionUnavailable
                        ? "실물 검수 결과 제작 불가"
                        : "실물 검수 후 변경 조건 미승인",
                    },
                    {
                      label: "결제 상태",
                      value: "승인 취소 · 전액 환불 접수",
                    },
                  ]}
                />
              </Section>
            </>
          ) : (
            <>
              <SectionBand />
              <Section
                className={styles.figmaOrderSection}
                title="배송 정보"
              >
                <div
                  className={styles.deliveryStepper}
                  id="delivery-information"
                >
                  <ProgressStepper
                    currentIndex={STAGE_DETAILS[stage].currentIndex}
                    items={PROGRESS_STEPS}
                  />
                </div>
                <div className={styles.divider} />
                <KeyValueList
                  className={styles.figmaOrderInfoList}
                  items={[
                    { label: "수령인", value: orderDraft.name },
                    { label: "휴대폰", value: orderDraft.phone },
                    {
                      label: "주소지",
                      value: `${orderDraft.address} ${orderDraft.addressDetail}`,
                    },
                  ]}
                />
              </Section>

              <SectionBand />
              <Section
                className={styles.figmaOrderSection}
                title="결제 정보"
              >
                <div className={styles.divider} />
                <KeyValueList
                  className={`${styles.figmaOrderInfoList} ${styles.figmaPaymentList}`}
                  items={[
                    {
                      label: "상품 금액",
                      value: formatKrw(displayedPrice),
                    },
                    {
                      label: "총 배송비",
                      value: formatKrw(order.pickupFeeKrw),
                    },
                    { label: "결제 수단", value: order.paymentMethodLabel },
                    {
                      emphasis: true,
                      label: "최종 결제 금액",
                      value: formatKrw(displayedPrice + order.pickupFeeKrw),
                    },
                  ]}
                />
              </Section>

              {stage === "change-required" ? (
                <>
                  <SectionBand />
                  <Section
                    description={expertInspection.reason}
                    title="실물 검수 결과"
                  >
                    <div className={styles.changeComparison}>
                      <article className={styles.changeCard}>
                        <h3>AI 예상 조건</h3>
                        <KeyValueList
                          items={[
                            {
                              label: "재사용률",
                              value: `${analysis.expectedReusableMaterialRate}%`,
                            },
                            {
                              label: "제작 금액",
                              value: formatKrw(selectedDesign.initialPriceKrw),
                            },
                            {
                              label: "제작 기간",
                              value: selectedDesign.initialEstimatedDuration,
                            },
                          ]}
                        />
                      </article>
                      <article className={styles.changeCardEmphasis}>
                        <h3>전문가 실물 검수</h3>
                        <KeyValueList
                          items={[
                            {
                              label: "재사용률",
                              value: `${expertInspection.revisedReusableMaterialRate}%`,
                            },
                            {
                              label: "제작 금액",
                              value: formatKrw(expertInspection.revisedPriceKrw),
                            },
                            {
                              label: "제작 기간",
                              value: expertInspection.revisedDuration,
                            },
                          ]}
                        />
                      </article>
                    </div>
                    <p className={styles.decisionNotice}>
                      승인하면 변경된 조건으로 제작이 시작됩니다. 거절하면 신청이
                      취소됩니다.
                    </p>
                    <div className={styles.decisionActions}>
                      <ButtonLink
                        fullWidth
                        href="/orders/demo?stage=production"
                      >
                        변경 조건 승인
                      </ButtonLink>
                      <ButtonLink
                        fullWidth
                        href="/orders/demo?stage=canceled"
                        variant="danger"
                      >
                        변경 조건 거절
                      </ButtonLink>
                    </div>
                  </Section>
                </>
              ) : null}

              {usesFinalTerms ? (
                <>
                  <SectionBand />
                  <Section title="확정 제작 조건">
                    <KeyValueList
                      items={[
                        {
                          label: "최종 재사용률",
                          value: `${expertInspection.revisedReusableMaterialRate}%`,
                        },
                        {
                          label: "최종 제작 금액",
                          value: formatKrw(expertInspection.revisedPriceKrw),
                        },
                        {
                          label: "예상 제작 기간",
                          value: expertInspection.revisedDuration,
                        },
                      ]}
                    />
                  </Section>
                </>
              ) : null}
            </>
          )}
        </>
      )}
    </AppShell>
  );
}
