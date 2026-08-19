"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { formatKrw } from "@/data/demo-scenario";
import {
  hasConfirmedInspection,
  getNextOperationTransition,
  OPERATION_APPLICATION,
  OPERATION_STATUSES,
  OPERATION_STAGE_PRESENTATION,
  operationDetailHref,
  readOperationStatus,
  type OperationStatus,
} from "./operations-data";
import {
  operatorFetch,
  type InspectionResponse,
  type LifecycleCommandResponse,
  type OperatorApplicationDetail,
} from "./operator-client";
import { OperationsShell } from "./OperationsShell";
import styles from "./operations.module.css";

type OperationsDetailScreenProps = {
  applicationId: string;
  found: boolean;
  status: OperationStatus;
};

const TIMELINE_STATUSES = [
  "ORDER_PLACED",
  "PRODUCT_RECEIVED",
  "IN_PRODUCTION",
  "QUALITY_CHECK",
  "COMPLETED",
] as const satisfies readonly OperationStatus[];

export function OperationsDetailScreen({
  applicationId,
  found,
  status,
}: OperationsDetailScreenProps) {
  const router = useRouter();
  const [liveDetail, setLiveDetail] = useState<
    OperatorApplicationDetail | null
  >(null);
  const [liveStatus, setLiveStatus] = useState<OperationStatus | null>(null);
  const [liveError, setLiveError] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);

  useEffect(() => {
    if (!found) {
      return;
    }

    let cancelled = false;
    operatorFetch<OperatorApplicationDetail>(
      `/api/v2/admin/applications/${applicationId}`,
    )
      .then((response) => {
        if (!cancelled) {
          setLiveDetail(response);
          setLiveStatus(readOperationStatus(response.application.effectiveStatus));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLiveError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [applicationId, found]);

  if (!found) {
    return (
      <OperationsShell>
        <Card className={styles.notFoundState} tone="outline">
          <span>404</span>
          <h1>신청 내역을 찾을 수 없습니다.</h1>
          <p>중앙 데모 데이터에 등록된 신청 번호인지 확인해 주세요.</p>
          <ButtonLink href="/operations" size="medium">
            신청 목록으로 돌아가기
          </ButtonLink>
        </Card>
      </OperationsShell>
    );
  }

  const viewStatus = liveStatus ?? status;
  const stage = OPERATION_STAGE_PRESENTATION[viewStatus];
  const transition = getNextOperationTransition(viewStatus);
  const confirmedInspection = hasConfirmedInspection(viewStatus);
  const liveApplication = liveDetail?.application;
  const liveTerms = confirmedInspection
    ? liveApplication?.finalTerms ?? liveApplication?.initialTerms
    : liveApplication?.initialTerms;
  const displayedPriceKrw =
    liveTerms?.amount.amount ??
    (confirmedInspection
      ? OPERATION_APPLICATION.expertInspection.revisedPriceKrw
      : OPERATION_APPLICATION.product.initialPriceKrw);
  const displayedDuration =
    liveTerms?.estimatedDuration ??
    (confirmedInspection
      ? OPERATION_APPLICATION.expertInspection.revisedDuration
      : OPERATION_APPLICATION.product.initialEstimatedDuration);
  const displayedReuseRate =
    liveTerms?.estimatedReusableMaterialRate ??
    (confirmedInspection
      ? OPERATION_APPLICATION.expertInspection.revisedReusableMaterialRate
      : OPERATION_APPLICATION.analysis.expectedReusableMaterialRate);
  const productName = liveApplication?.product.name ?? OPERATION_APPLICATION.product.name;
  const productImage = liveApplication?.product.listImage ?? OPERATION_APPLICATION.product.image;
  const applicationNumber =
    liveApplication?.applicationNumber ?? OPERATION_APPLICATION.applicationNumber;
  const customerName =
    liveDetail?.customer.displayName ?? OPERATION_APPLICATION.customer.name;
  const customerEmail = liveDetail?.customer.email;
  const liveAddress = readAddress(liveApplication?.shippingAddress);
  const customerAddress = liveAddress ||
    `${OPERATION_APPLICATION.customer.address} ${OPERATION_APPLICATION.customer.addressDetail}`;

  async function handleAdvance() {
    if (!transition || isActionPending) {
      return;
    }

    setActionError(false);
    setIsActionPending(true);
    try {
      if (transition.mode === "inspection-api") {
        const response = await operatorFetch<InspectionResponse>(
          `/api/v2/admin/applications/${applicationId}/inspection`,
          {
            body: JSON.stringify({
              confirmedReusableAreaCm2:
                readNumber(liveDetail?.analysis, "estimatedReusableAreaCm2") ??
                OPERATION_APPLICATION.certificate.reusedAreaCm2,
              confirmedReusableMaterialRate: displayedReuseRate,
              outcome: "NO_CHANGE",
              reason: "장인 실물 검수를 완료했습니다. 제작을 진행합니다.",
              proposedTerms: null,
            }),
            method: "POST",
          },
        );
        const nextStatus = readOperationStatus(response.applicationStatus);
        setLiveStatus(nextStatus);
        router.replace(operationDetailHref(nextStatus, applicationId));
      } else {
        const targetStatus = transition.targetStatus;
        const response = await operatorFetch<LifecycleCommandResponse>(
          `/api/v2/admin/applications/${applicationId}/lifecycle-commands`,
          {
            body: JSON.stringify({
              ...(targetStatus === "SHIPPED"
                ? {
                    carrierCode: "MCM_REBORN_DEMO",
                    carrierName: "MCM RE:BORN Demo Logistics",
                    trackingNumber: `MCM-${applicationId
                      .slice(0, 8)
                      .toUpperCase()}`,
                  }
                : {}),
              note: transition.note,
              targetStatus,
            }),
            method: "POST",
          },
        );
        const nextStatus = readOperationStatus(response.applicationStatus);
        setLiveStatus(nextStatus);
        router.replace(operationDetailHref(nextStatus, applicationId));
      }
    } catch {
      setActionError(true);
    } finally {
      setIsActionPending(false);
    }
  }

  return (
    <OperationsShell>
      <nav aria-label="현재 위치" className={styles.breadcrumb}>
        <Link href={`/operations?status=${viewStatus}`}>신청 목록</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{applicationNumber}</span>
      </nav>

      <aside className={styles.fixtureNotice} aria-label="운영 API 연결 상태">
        <strong>{liveDetail ? "Supabase v2 연결" : "운영 API 조회 중"}</strong>
        <span>
          {liveDetail
            ? "이 신청의 최신 상태와 고객 정보를 조회했습니다."
            : liveError
              ? "운영 API를 확인하지 못해 데모 정보를 표시합니다."
              : "운영자 인증으로 신청 상세를 확인하고 있습니다."}
        </span>
      </aside>

      <header className={styles.detailHeading}>
        <div>
          <span className={styles.statusBadge}>{stage.label}</span>
          <h1>{productName}</h1>
          <p>{applicationNumber}</p>
        </div>
        <div className={styles.ownerBadge}>
          <span>현재 담당</span>
          <strong>{stage.owner}</strong>
        </div>
      </header>

      <div className={styles.detailGrid}>
        <div className={styles.detailMain}>
          <Card className={styles.productCard} tone="outline">
            <div className={styles.detailProductImage}>
              <Image
                alt={`${productName} 제품 이미지`}
                fill
                priority
                sizes="(min-width: 900px) 220px, 42vw"
                src={productImage}
              />
            </div>
            <div className={styles.detailProductCopy}>
              <p>제작 제품</p>
              <h2>{productName}</h2>
              <span>
                원제품 · {OPERATION_APPLICATION.sourceProduct.name}
              </span>
              <KeyValueList
                className={styles.compactKeyValues}
                items={[
                  {
                    label: confirmedInspection ? "확정 제작비" : "예상 제작비",
                    value: formatKrw(displayedPriceKrw),
                  },
                  {
                    label: "예상 기간",
                    value: displayedDuration,
                  },
                  {
                    label: confirmedInspection
                      ? "확정 재사용률"
                      : "AI 예상 재사용률",
                    value: `${displayedReuseRate}%`,
                  },
                ]}
              />
            </div>
          </Card>

          <div className={styles.infoGrid}>
            <Card className={styles.infoCard} tone="outline">
              <h2>고객 및 수거 정보</h2>
              <KeyValueList
                className={styles.compactKeyValues}
                dividers
                items={[
                  {
                    label: "고객명",
                    value: customerName,
                  },
                  {
                    label: "고객 이메일",
                    value: customerEmail ?? "데모 고객",
                  },
                  {
                    label: "수거 일정",
                    value: `${OPERATION_APPLICATION.pickupDateLabel} ${OPERATION_APPLICATION.pickupTimeLabel}`,
                  },
                  {
                    label: "수거 주소",
                    value: customerAddress,
                  },
                ]}
              />
            </Card>

            <Card className={styles.infoCard} tone="outline">
              <h2>실물 검수 기준</h2>
              <p className={styles.inspectionReason}>
                {confirmedInspection
                  ? OPERATION_APPLICATION.expertInspection.reason
                  : "제품 입고 후 장인이 원단 상태와 실제 제작 범위를 확인합니다."}
              </p>
              <KeyValueList
                className={styles.compactKeyValues}
                dividers
                items={[
                  {
                    label: "검수 결과",
                    value: confirmedInspection
                      ? "조건 변경 · 고객 승인 완료"
                      : viewStatus === "EXPERT_INSPECTION"
                        ? "장인 실물 검수 진행 중"
                        : "제품 입고 후 진행",
                  },
                  {
                    label: "검수일",
                    value: confirmedInspection
                      ? OPERATION_APPLICATION.expertInspection.inspectedAt
                      : "미정",
                  },
                  {
                    label: confirmedInspection
                      ? "확정 제작비"
                      : "현재 예상 제작비",
                    value: formatKrw(displayedPriceKrw),
                  },
                ]}
              />
            </Card>
          </div>
        </div>

        <aside className={styles.progressCard} aria-labelledby="progress-title">
          <div className={styles.progressHeader}>
            <p>공정 진행</p>
            <h2 id="progress-title">{stage.label}</h2>
            <span>{stage.description}</span>
          </div>

          <ol className={styles.miniTimeline}>
            {TIMELINE_STATUSES.map((timelineStatus, timelineIndex) => {
              const statusIndex = OPERATION_STATUSES.indexOf(viewStatus);
              const milestoneIndex = OPERATION_STATUSES.indexOf(timelineStatus);
              const nextTimelineStatus = TIMELINE_STATUSES[timelineIndex + 1];
              const nextMilestoneIndex = nextTimelineStatus
                ? OPERATION_STATUSES.indexOf(nextTimelineStatus)
                : Number.POSITIVE_INFINITY;
              const isCurrent =
                statusIndex >= milestoneIndex &&
                statusIndex < nextMilestoneIndex;
              const isComplete = statusIndex >= nextMilestoneIndex;

              return (
                <li
                  aria-current={isCurrent ? "step" : undefined}
                  className={
                    isCurrent
                      ? styles.timelineCurrent
                      : isComplete
                        ? styles.timelineComplete
                        : ""
                  }
                  key={timelineStatus}
                >
                  <span aria-hidden="true" />
                  <span>{OPERATION_STAGE_PRESENTATION[timelineStatus].label}</span>
                </li>
              );
            })}
          </ol>

          <div className={styles.nextAction}>
            {transition ? (
              <>
                <span>다음 단계</span>
                <strong>
                  {OPERATION_STAGE_PRESENTATION[transition.targetStatus].label}
                </strong>
                <p>{transition.note}</p>
                <Button
                  fullWidth
                  size="large"
                  disabled={isActionPending}
                  onClick={handleAdvance}
                >
                  {isActionPending ? "처리 중..." : transition.label}
                </Button>
                <small>
                  {transition.mode === "inspection-api"
                    ? "v2 실물 검수 API에 결과를 저장합니다."
                    : "v2 lifecycle 명령 API에 다음 상태를 저장합니다."}
                </small>
                {actionError ? (
                  <p role="alert" className={styles.actionError}>
                    운영 API에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.
                  </p>
                ) : null}
              </>
            ) : (
              <div className={styles.completeState}>
                <span aria-hidden="true">✓</span>
                <strong>모든 공정이 완료되었습니다.</strong>
                <p>이 신청에서는 더 진행할 단계가 없습니다.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </OperationsShell>
  );
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readNumber(value: unknown, key: string): number | null {
  const candidate = readRecord(value)?.[key];
  return typeof candidate === "number" && Number.isFinite(candidate)
    ? candidate
    : null;
}

function readAddress(value: unknown): string | null {
  const record = readRecord(value);
  const address = typeof record?.address === "string" ? record.address : "";
  const addressDetail =
    typeof record?.addressDetail === "string" ? record.addressDetail : "";
  const combined = [address, addressDetail].filter(Boolean).join(" ").trim();
  return combined || null;
}
