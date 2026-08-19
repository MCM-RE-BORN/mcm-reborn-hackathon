"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { KeyValueList } from "@/components/ui/KeyValueList";
import {
  hasConfirmedInspection,
  getNextOperationTransition,
  OPERATION_STATUSES,
  OPERATION_STAGE_PRESENTATION,
  operationDetailHref,
  readOperationStatus,
  type OperationStatus,
} from "./operations-data";
import {
  operatorFetch,
  OperatorApiError,
  readOperatorImageUrl,
  type InspectionResponse,
  type LifecycleCommandResponse,
  type OperatorApplicationDetail,
} from "./operator-client";
import { OperatorLoginPanel } from "./OperatorLoginPanel";
import { OperationsShell } from "./OperationsShell";
import styles from "./operations.module.css";

type OperationsDetailScreenProps = {
  applicationId: string;
  found: boolean;
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
}: OperationsDetailScreenProps) {
  const router = useRouter();
  const [liveDetail, setLiveDetail] = useState<
    OperatorApplicationDetail | null
  >(null);
  const [liveStatus, setLiveStatus] = useState<OperationStatus | null>(null);
  const [liveError, setLiveError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
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
  }, [applicationId, found, reloadToken]);

  if (!found) {
    return (
      <OperationsShell>
        <Card className={styles.notFoundState} tone="outline">
          <span>404</span>
          <h1>신청 내역을 찾을 수 없습니다.</h1>
          <p>신청 번호와 운영자 권한을 확인해 주세요.</p>
          <ButtonLink href="/operations" size="medium">
            신청 목록으로 돌아가기
          </ButtonLink>
        </Card>
      </OperationsShell>
    );
  }

  if (!liveDetail) {
    return (
      <OperationsShell>
        <Card className={styles.notFoundState} tone="outline">
          <span>{liveError ? "오류" : "조회 중"}</span>
          <h1>{liveError ? "신청 정보를 불러오지 못했습니다." : "신청 정보를 불러오는 중입니다."}</h1>
          <p>
            {liveError
              ? "운영자 인증과 Supabase 연결을 확인한 뒤 다시 시도해 주세요."
              : "Supabase에서 최신 신청 정보를 확인하고 있습니다."}
          </p>
          {liveError ? (
            <>
              <OperatorLoginPanel
                onAuthenticated={() => {
                  setLiveError(false);
                  setLiveDetail(null);
                  setReloadToken((value) => value + 1);
                }}
              />
              <ButtonLink href={`/operations/${applicationId}`} size="medium">
                다시 시도
              </ButtonLink>
            </>
          ) : null}
        </Card>
      </OperationsShell>
    );
  }

  const viewStatus = liveStatus ?? readOperationStatus(liveDetail.application.effectiveStatus);
  const stage = OPERATION_STAGE_PRESENTATION[viewStatus];
  const transition = getNextOperationTransition(viewStatus);
  const confirmedInspection = hasConfirmedInspection(viewStatus);
  const liveApplication = liveDetail.application;
  const liveTerms = confirmedInspection
    ? liveApplication.finalTerms ?? liveApplication.initialTerms
    : liveApplication.initialTerms;
  const displayedPriceKrw = liveTerms?.amount.amount ?? null;
  const displayedDuration = liveTerms?.estimatedDuration ?? "-";
  const displayedReuseRate = liveTerms?.estimatedReusableMaterialRate ?? null;
  const productName = liveApplication.product.name;
  const productImage = readOperatorImageUrl(liveApplication.product.listImage);
  const applicationNumber = liveApplication.applicationNumber;
  const customerName = liveDetail.customer.displayName;
  const customerEmail = liveDetail.customer.email;
  const customerAddress = readAddress(liveApplication.shippingAddress) ?? "등록된 수거지 없음";
  const pickupDate = readString(liveApplication.pickupSchedule, "requestedDate");
  const pickupTime = readString(liveApplication.pickupSchedule, "timeWindow");
  const sourceCategory = readNestedString(liveDetail.analysis, "sourceProduct", "category") ?? "-";

  async function handleAdvance() {
    if (!transition || isActionPending || !liveDetail) {
      return;
    }

    setActionError(null);
    setIsActionPending(true);
    try {
      if (transition.mode === "inspection-api") {
        const confirmedArea = readNumber(
          liveDetail.analysis,
          "estimatedReusableAreaCm2",
        );
        if (confirmedArea === null || displayedReuseRate === null) {
          throw new Error("검수에 필요한 분석 수치를 확인하지 못했습니다.");
        }
        const response = await operatorFetch<InspectionResponse>(
          `/api/v2/admin/applications/${applicationId}/inspection`,
          {
            body: JSON.stringify({
              confirmedReusableAreaCm2: confirmedArea,
              confirmedReusableMaterialRate: displayedReuseRate,
              outcome: "NO_CHANGE",
              reason: "장인 실물 검수를 완료했습니다. 제작을 진행합니다.",
              proposedTerms: null,
            }),
            headers: {
              "Idempotency-Key": `operations-v2-${applicationId}-inspection-${viewStatus}`,
            },
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
              targetStatus,
            }),
            headers: {
              "Idempotency-Key": `operations-v2-${applicationId}-${viewStatus}-${targetStatus}`,
            },
            method: "POST",
          },
        );
        const nextStatus = readOperationStatus(response.applicationStatus);
        setLiveStatus(nextStatus);
        router.replace(operationDetailHref(nextStatus, applicationId));
      }
    } catch (error) {
      if (error instanceof OperatorApiError && error.status === 401) {
        setLiveDetail(null);
        setLiveError(true);
        return;
      }

      // A lifecycle/inspection RPC can commit even when the response or the
      // idempotency cache write is interrupted. Re-read the authoritative DB
      // state before showing an error so the console never keeps a stale
      // action button after the customer view has already advanced.
      try {
        const latest = await operatorFetch<OperatorApplicationDetail>(
          `/api/v2/admin/applications/${applicationId}`,
        );
        const latestStatus = readOperationStatus(
          latest.application.effectiveStatus,
        );
        setLiveDetail(latest);
        setLiveStatus(latestStatus);
        if (latestStatus !== viewStatus) {
          router.replace(operationDetailHref(latestStatus, applicationId));
          return;
        }
      } catch {
        // Preserve the original mutation error when the recovery read fails.
      }
      setActionError(
        error instanceof OperatorApiError
          ? error.message
          : "운영 API에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
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
              {productImage ? (
                <Image
                  alt={`${productName} 제품 이미지`}
                  fill
                  priority
                  sizes="(min-width: 900px) 220px, 42vw"
                  src={productImage}
                />
              ) : (
                <span aria-hidden="true" className={styles.imagePlaceholder}>
                  MCM
                </span>
              )}
            </div>
            <div className={styles.detailProductCopy}>
              <p>제작 제품</p>
              <h2>{productName}</h2>
              <span>원제품 · {sourceCategory}</span>
              <KeyValueList
                className={styles.compactKeyValues}
                items={[
                  {
                    label: confirmedInspection ? "확정 제작비" : "예상 제작비",
                    value: displayedPriceKrw === null ? "-" : formatKrw(displayedPriceKrw),
                  },
                  {
                    label: "예상 기간",
                    value: displayedDuration,
                  },
                  {
                    label: confirmedInspection
                      ? "확정 재사용률"
                      : "AI 예상 재사용률",
                    value: displayedReuseRate === null ? "-" : `${displayedReuseRate}%`,
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
                    value: customerEmail || "등록된 이메일 없음",
                  },
                  {
                    label: "수거 일정",
                    value: [pickupDate, pickupTime].filter(Boolean).join(" ") || "미정",
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
                  ? "장인 실물 검수 결과가 신청 정보에 반영되었습니다."
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
                      ? liveApplication.inspectionCompletedAt ?? "확인 중"
                      : "미정",
                  },
                  {
                    label: confirmedInspection
                      ? "확정 제작비"
                      : "현재 예상 제작비",
                    value: displayedPriceKrw === null ? "-" : formatKrw(displayedPriceKrw),
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
                    {actionError}
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

function readString(value: unknown, key: string): string {
  const candidate = readRecord(value)?.[key];
  return typeof candidate === "string" ? candidate : "";
}

function readNestedString(value: unknown, parentKey: string, key: string): string | null {
  return readString(readRecord(value)?.[parentKey], key) || null;
}

function readAddress(value: unknown): string | null {
  const record = readRecord(value);
  const address =
    typeof record?.address1 === "string"
      ? record.address1
      : typeof record?.address === "string"
        ? record.address
        : "";
  const addressDetail =
    typeof record?.address2 === "string"
      ? record.address2
      : typeof record?.addressDetail === "string"
        ? record.addressDetail
        : "";
  const combined = [address, addressDetail].filter(Boolean).join(" ").trim();
  return combined || null;
}

function formatKrw(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
}
