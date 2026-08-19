"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { ActionButtonLink } from "@/components/ui/ActionButtonLink";
import { Button } from "@/components/ui/Button";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { formatApiDate, formatKrw } from "@/lib/formatters";
import { ProgressStepper } from "@/components/ui/ProgressStepper";
import { SectionBand } from "@/components/ui/SectionBand";
import { StatusPanel } from "@/components/ui/StatusPanel";
import type { DemoState } from "./demo-state";
import { DemoStatePanel } from "./DemoStatePanel";
import {
  applicationStatusToOrderStage,
  customerFetch,
  readImageUrl,
  readJsonString,
  type CustomerAnalysis,
  type CustomerApplicationDetail,
  type CustomerChangeRequest,
  type CustomerShipment,
  type CustomerTimeline,
} from "./customer-client";
import styles from "./order-certificate.module.css";

type OrderDetailsScreenProps = {
  applicationId?: string;
  state: Extract<
    DemoState,
    "normal" | "loading" | "empty" | "error" | "permission"
  >;
};

const PROGRESS_STEPS = ["접수", "검수", "제작중", "품질확인", "배송", "완료"];

const STAGE_COPY = {
  canceled: {
    description: "이 신청은 서버 상태에 따라 취소 처리되었습니다.",
    title: "신청이 취소되었습니다",
    tone: "empty" as const,
  },
  completed: {
    description: "제작과 품질 확인, 배송이 모두 완료되었습니다.",
    title: "RE:BORN 여정이 완료되었어요",
    tone: "success" as const,
  },
  "change-required": {
    description: "전문가 검수 결과 변경된 조건의 고객 승인이 필요합니다.",
    title: "변경된 제작 조건을 확인해 주세요",
    tone: "permission" as const,
  },
  inspection: {
    description: "전문가가 원단 상태와 실제 제작 범위를 확인하고 있습니다.",
    title: "전문가 실물 검수 중이에요",
    tone: "permission" as const,
  },
  pickup: {
    description: "신청된 일정에 따라 원제품 수거와 입고를 준비합니다.",
    title: "수거를 기다리고 있어요",
    tone: "permission" as const,
  },
  "production-ready": {
    description: "전문가 실물 검수가 완료되어 장인 제작 시작을 준비하고 있습니다.",
    title: "실물 검수가 완료되었어요",
    tone: "success" as const,
  },
  production: {
    description: "승인된 최종 조건에 따라 제품을 제작하고 있습니다.",
    title: "장인 제작이 시작되었어요",
    tone: "success" as const,
  },
  quality: {
    description: "완성 제품의 마감과 최종 품질을 확인하고 있습니다.",
    title: "최종 품질을 확인하고 있어요",
    tone: "success" as const,
  },
  shipping: {
    description: "품질 확인을 마친 제품이 배송 중입니다.",
    title: "완성된 제품을 배송하고 있어요",
    tone: "success" as const,
  },
} as const;

const STAGE_INDEX = {
  canceled: 0,
  completed: 5,
  "change-required": 1,
  inspection: 1,
  pickup: 0,
  "production-ready": 1,
  production: 2,
  quality: 3,
  shipping: 4,
} as const;

const STATUS_ORDER = [
  "PENDING_PAYMENT",
  "ORDER_PLACED",
  "PICKUP_SCHEDULED",
  "PICKUP_IN_PROGRESS",
  "PRODUCT_RECEIVED",
  "EXPERT_INSPECTION",
  "CHANGE_APPROVAL_REQUIRED",
  "PRODUCTION_READY",
  "IN_PRODUCTION",
  "QUALITY_CHECK",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
  "PRODUCTION_UNAVAILABLE",
  "CANCELED",
] as const;

export function OrderDetailsScreen({
  applicationId,
  state,
}: OrderDetailsScreenProps) {
  const [application, setApplication] =
    useState<CustomerApplicationDetail | null>(null);
  const [timeline, setTimeline] = useState<CustomerTimeline | null>(null);
  const [analysis, setAnalysis] = useState<CustomerAnalysis | null>(null);
  const [shipment, setShipment] = useState<CustomerShipment | null>(null);
  const [changeRequest, setChangeRequest] =
    useState<CustomerChangeRequest | null>(null);
  const [changeRequestResolved, setChangeRequestResolved] = useState(false);
  const [localEffectiveStatus, setLocalEffectiveStatus] = useState<string | null>(
    null,
  );
  const [requestError, setRequestError] = useState(false);
  const [decisionPending, setDecisionPending] = useState(false);

  useEffect(() => {
    if (!applicationId) {
      return;
    }
    let cancelled = false;
    let loading = false;
    let firstLoad = true;
    async function loadApplication() {
      if (loading || document.visibilityState !== "visible") {
        return;
      }
      loading = true;
      const initialLoad = firstLoad;
      firstLoad = false;
      try {
        if (initialLoad) {
          setApplication(null);
          setTimeline(null);
          setAnalysis(null);
          setShipment(null);
          setChangeRequest(null);
          setChangeRequestResolved(false);
          setLocalEffectiveStatus(null);
          setRequestError(false);
        }
        const detail = await customerFetch<CustomerApplicationDetail>(
          `/api/v2/applications/${applicationId}`,
        );
        const [timelineResult, analysisResult, shipmentResult, changeResult] =
          await Promise.allSettled([
            customerFetch<CustomerTimeline>(
              `/api/v2/applications/${applicationId}/timeline`,
            ),
            customerFetch<CustomerAnalysis>(
              `/api/v2/analyses/${detail.analysisId}`,
            ),
            customerFetch<CustomerShipment>(
              `/api/v2/applications/${applicationId}/shipment`,
            ),
            customerFetch<CustomerChangeRequest>(
              `/api/v2/applications/${applicationId}/change-request`,
            ),
          ]);
        if (cancelled) {
          return;
        }
        setApplication(detail);
        setLocalEffectiveStatus((current) =>
          current && statusRank(detail.effectiveStatus) >= statusRank(current)
            ? null
            : current,
        );
        if (timelineResult.status === "fulfilled") {
          setTimeline(timelineResult.value);
        }
        if (analysisResult.status === "fulfilled") {
          setAnalysis(analysisResult.value);
        }
        if (shipmentResult.status === "fulfilled") {
          setShipment(shipmentResult.value);
        }
        if (changeResult.status === "fulfilled") {
          setChangeRequest(changeResult.value);
        } else if (initialLoad) {
          setChangeRequest(null);
        }
        setChangeRequestResolved(true);
        setRequestError(false);
      } catch {
        if (!cancelled && initialLoad) {
          setRequestError(true);
          setChangeRequestResolved(true);
        }
      } finally {
        loading = false;
      }
    }
    void loadApplication();
    const pollId = window.setInterval(() => void loadApplication(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, [applicationId]);

  async function decideChange(decision: "approve" | "reject") {
    if (!applicationId || decisionPending) {
      return;
    }
    setDecisionPending(true);
    try {
      const response = await customerFetch<{
        applicationId: string;
        applicationStatus: string;
        changeRequestId: string;
        decision: "APPROVED" | "REJECTED";
        respondedAt: string;
      }>(
        `/api/v2/applications/${applicationId}/change-request/${decision}`,
        {
          body:
            decision === "reject"
              ? JSON.stringify({ reason: "변경된 제작 조건을 승인하지 않습니다." })
              : undefined,
          method: "POST",
        },
      );
      const nextStatus = response.applicationStatus;
      const nextChangeStatus =
        response.decision === "APPROVED" ? "APPROVED" : "REJECTED";
      setLocalEffectiveStatus(nextStatus);
      setChangeRequest((current) =>
        current
          ? {
              ...current,
              respondedAt: response.respondedAt,
              status: nextChangeStatus,
            }
          : current,
      );
      setApplication((current) =>
        current
          ? {
              ...current,
              effectiveStatus: nextStatus,
              finalTerms:
                response.decision === "APPROVED"
                  ? changeRequest?.proposedTerms ?? current.finalTerms
                  : current.finalTerms,
              persistedStatus: nextStatus,
              status: nextStatus,
            }
          : current,
      );
      setTimeline((current) =>
        current
          ? {
              ...current,
              effectiveStatus: nextStatus,
              refreshedAt: new Date().toISOString(),
              steps: current.steps.map((step) =>
                step.status === nextStatus
                  ? { ...step, state: "CURRENT" as const }
                  : step.status === "CHANGE_APPROVAL_REQUIRED"
                    ? { ...step, state: "COMPLETED" as const }
                    : step,
              ),
            }
          : current,
      );
      setDecisionPending(false);
    } catch {
      setRequestError(true);
      setDecisionPending(false);
    }
  }

  const hasPendingChange =
    changeRequestResolved && changeRequest?.status === "PENDING";
  // A pending inspection change is authoritative for the customer-facing
  // journey. This also repairs older rows where an operator advanced the
  // application before the customer's decision was recorded.
  const effectiveStatus = hasPendingChange
    ? "CHANGE_APPROVAL_REQUIRED"
    : localEffectiveStatus ?? timeline?.effectiveStatus ?? application?.effectiveStatus;
  const stage = effectiveStatus
    ? applicationStatusToOrderStage(effectiveStatus)
    : null;
  const stageCopy = stage ? STAGE_COPY[stage] : null;
  const currentIndex = stage ? STAGE_INDEX[stage] : 0;
  const initialAmount = application?.amount.amount ?? null;
  const finalTerms = application?.finalTerms ?? null;
  const displayedAmount = finalTerms?.amount.amount ?? initialAmount;
  const displayedDuration =
    finalTerms?.estimatedDuration ?? application?.product.estimatedDuration ?? "-";
  const estimatedRate =
    analysis?.estimatedReusableMaterialRate ??
    application?.product.recommendation?.score ??
    null;
  const finalRate = finalTerms?.estimatedReusableMaterialRate ?? null;
  const image = readImageUrl(application?.product.listImage);
  const pickupDate = readJsonString(application?.pickupSchedule, "requestedDate");
  const pickupTime = readJsonString(application?.pickupSchedule, "timeWindow");
  const shippingAddress = [
    readJsonString(application?.shippingAddress, "address1") ||
      readJsonString(application?.shippingAddress, "address"),
    readJsonString(application?.shippingAddress, "address2") ||
      readJsonString(application?.shippingAddress, "addressDetail"),
  ]
    .filter(Boolean)
    .join(" ");
  const certificateHref =
    effectiveStatus === "COMPLETED"
      ? `/certificates/demo?applicationId=${applicationId}&state=issued`
      : "/certificates/demo?state=locked";
  const timelineDescription = useMemo(
    () => timeline?.steps.find((step) => step.status === effectiveStatus)?.description,
    [effectiveStatus, timeline],
  );

  return (
    <AppShell
      header={
        <PageHeader
          backHref="/orders"
          title="신청 내역"
        />
      }
    >
      {state !== "normal" ? (
        <div className={styles.stateInset}>
          <DemoStatePanel
            emptyDescription="아직 접수된 업사이클링 신청이 없습니다."
            retryHref="/orders"
            state={state}
            subject="신청 상세"
          />
        </div>
      ) : requestError || !applicationId ? (
        <div className={styles.stateInset}>
          <DemoStatePanel
            emptyDescription="신청 상세를 불러오지 못했습니다. 신청 목록에서 다시 선택해 주세요."
            retryHref="/orders"
            state="error"
            subject="신청 상세"
          />
        </div>
      ) : !application || !changeRequestResolved || !stage || !stageCopy ? (
        <div className={styles.stateInset}>
          <StatusPanel
            description="Supabase에서 신청 상태와 분석 결과를 불러오고 있습니다."
            title="신청 상세를 확인하고 있어요"
            tone="permission"
          />
        </div>
      ) : (
        <>
          <Section title="현재 진행 안내">
            <StatusPanel
              description={timelineDescription ?? stageCopy.description}
              title={stageCopy.title}
              tone={stageCopy.tone}
            />
            <KeyValueList
              items={[
                {
                  label: "수거 일정",
                  value: [pickupDate, pickupTime].filter(Boolean).join(" ") || "-",
                },
                { label: "제작 기간", value: displayedDuration },
              ]}
            />
          </Section>
          <SectionBand />

          <article
            aria-labelledby="order-product-name"
            className={styles.orderSummary}
          >
            <div className={styles.orderProductRow}>
              <div className={styles.productThumbnail}>
                <Image
                  alt={`${application.product.name} 제품 이미지`}
                  fill
                  sizes="40px"
                  src={image}
                />
              </div>
              <div className={styles.orderProductCopy}>
                <h2 id="order-product-name">{application.product.name}</h2>
                <p>신청일 {formatApiDate(application.createdAt)}</p>
                <span>신청번호 {application.applicationNumber}</span>
              </div>
              <strong>
                {displayedAmount === null ? "-" : formatKrw(displayedAmount)}
              </strong>
            </div>

            <div className={styles.orderActionGrid}>
              <button disabled type="button">
                문의하기
              </button>
              <a href="#delivery-information">배송현황</a>
            </div>
            <ActionButtonLink
              className={styles.orderCertificateAction}
              fullWidth
              href={certificateHref}
            >
              나의 RE:BORN 인증서 보기
            </ActionButtonLink>
          </article>

          <SectionBand />
          <Section className={styles.figmaOrderSection} title="배송 정보">
            <div className={styles.deliveryStepper} id="delivery-information">
              <ProgressStepper currentIndex={currentIndex} items={PROGRESS_STEPS} />
            </div>
            <div className={styles.divider} />
            <KeyValueList
              className={styles.figmaOrderInfoList}
              items={[
                {
                  label: "수령인",
                  value:
                    readJsonString(application.shippingAddress, "recipientName") ||
                    readJsonString(application.shippingAddress, "name") ||
                    "-",
                },
                {
                  label: "휴대폰",
                  value: readJsonString(application.shippingAddress, "phone") || "-",
                },
                { label: "주소지", value: shippingAddress || "-" },
                ...(shipment
                  ? [
                      { label: "배송사", value: shipment.carrierName },
                      { label: "운송장", value: shipment.trackingNumber },
                    ]
                  : []),
              ]}
            />
          </Section>

          <SectionBand />
          <Section className={styles.figmaOrderSection} title="신청 정보">
            <div className={styles.divider} />
            <KeyValueList
              className={styles.figmaOrderInfoList}
              items={[
                { label: "신청 상태", value: statusLabel(effectiveStatus) },
                { label: "원본 제품군", value: analysis?.sourceProduct.category ?? "-" },
                { label: "분석 상태", value: analysis ? "분석 완료" : "확인 중" },
                {
                  label: "AI 예상 재사용률",
                  value: estimatedRate === null ? "-" : `${estimatedRate}%`,
                },
                ...(finalRate === null
                  ? []
                  : [{ label: "확정 재사용률", value: `${finalRate}%` }]),
              ]}
            />
          </Section>

          {changeRequest ? (
            <>
              <SectionBand />
              <Section description={changeRequest.reason} title="실물 검수 결과">
                <div className={styles.changeComparison}>
                  <article className={styles.changeCard}>
                    <h3>AI 예상 조건</h3>
                    <KeyValueList
                      items={[
                        { label: "재사용률", value: `${changeRequest.previousTerms.estimatedReusableMaterialRate}%` },
                        { label: "제작 금액", value: formatKrw(changeRequest.previousTerms.amount.amount) },
                        { label: "제작 기간", value: changeRequest.previousTerms.estimatedDuration },
                      ]}
                    />
                  </article>
                  <article className={styles.changeCardEmphasis}>
                    <h3>전문가 실물 검수</h3>
                    <KeyValueList
                      items={[
                        { label: "재사용률", value: `${changeRequest.proposedTerms.estimatedReusableMaterialRate}%` },
                        { label: "제작 금액", value: formatKrw(changeRequest.proposedTerms.amount.amount) },
                        { label: "제작 기간", value: changeRequest.proposedTerms.estimatedDuration },
                      ]}
                    />
                  </article>
                </div>
                {hasPendingChange ? (
                  <>
                    <p className={styles.decisionNotice}>
                      승인하면 변경된 조건으로 제작이 시작됩니다. 거절하면 신청이 취소됩니다.
                    </p>
                    <div className={styles.decisionActions}>
                      <Button
                        disabled={decisionPending}
                        fullWidth
                        onClick={() => void decideChange("approve")}
                      >
                        {decisionPending ? "처리 중..." : "변경 조건 승인"}
                      </Button>
                      <Button
                        disabled={decisionPending}
                        fullWidth
                        onClick={() => void decideChange("reject")}
                        variant="danger"
                      >
                        변경 조건 거절
                      </Button>
                    </div>
                  </>
                ) : (
                  <StatusPanel
                    description={
                      changeRequest.respondedAt
                        ? `고객 결정일 ${formatApiDate(changeRequest.respondedAt)}`
                        : "고객 결정이 저장되었습니다."
                    }
                    title={
                      changeRequest.status === "APPROVED"
                        ? "변경 조건이 승인되어 제작을 진행했어요"
                        : "변경 조건이 승인되지 않아 신청이 취소되었어요"
                    }
                    tone={changeRequest.status === "APPROVED" ? "success" : "empty"}
                  />
                )}
              </Section>
            </>
          ) : null}

          {stage === "canceled" ? (
            <>
              <SectionBand />
              <Section title="신청 취소">
                <StatusPanel
                  action={<ActionButtonLink fullWidth href="/home">홈으로 이동</ActionButtonLink>}
                  description={stageCopy.description}
                  title={stageCopy.title}
                  tone="empty"
                />
              </Section>
            </>
          ) : null}
        </>
      )}
    </AppShell>
  );
}

function statusLabel(status: string | undefined) {
  const labels: Record<string, string> = {
    CANCELED: "신청 취소",
    CHANGE_APPROVAL_REQUIRED: "변경 조건 승인 대기",
    COMPLETED: "완료",
    DELIVERED: "배송 완료",
    EXPERT_INSPECTION: "실물 검수 중",
    IN_PRODUCTION: "제작 중",
    ORDER_PLACED: "신청 접수",
    PICKUP_IN_PROGRESS: "수거 중",
    PICKUP_SCHEDULED: "수거 예정",
    PRODUCT_RECEIVED: "제품 입고",
    PRODUCTION_READY: "제작 준비",
    PRODUCTION_UNAVAILABLE: "제작 불가",
    QUALITY_CHECK: "품질 확인",
    SHIPPED: "배송 중",
  };
  return (status && labels[status]) || "확인 중";
}

function statusRank(status: string) {
  const index = STATUS_ORDER.indexOf(status as (typeof STATUS_ORDER)[number]);
  return index === -1 ? Number.NEGATIVE_INFINITY : index;
}
