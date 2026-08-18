import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { formatKrw } from "@/data/demo-scenario";
import {
  getNextOperationTransition,
  OPERATION_APPLICATION,
  OPERATION_STAGE_PRESENTATION,
  OPERATION_STATUSES,
  operationDetailHref,
  type OperationStatus,
} from "./operations-data";
import { OperationsShell } from "./OperationsShell";
import styles from "./operations.module.css";

type OperationsDetailScreenProps = {
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
  found,
  status,
}: OperationsDetailScreenProps) {
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

  const stage = OPERATION_STAGE_PRESENTATION[status];
  const transition = getNextOperationTransition(status);
  const hasConfirmedInspection =
    OPERATION_STATUSES.indexOf(status) >=
    OPERATION_STATUSES.indexOf("PRODUCTION_READY");
  const displayedPriceKrw = hasConfirmedInspection
    ? OPERATION_APPLICATION.expertInspection.revisedPriceKrw
    : OPERATION_APPLICATION.product.initialPriceKrw;
  const displayedDuration = hasConfirmedInspection
    ? OPERATION_APPLICATION.expertInspection.revisedDuration
    : OPERATION_APPLICATION.product.initialEstimatedDuration;
  const displayedReuseRate = hasConfirmedInspection
    ? OPERATION_APPLICATION.expertInspection.revisedReusableMaterialRate
    : OPERATION_APPLICATION.analysis.expectedReusableMaterialRate;

  return (
    <OperationsShell>
      <nav aria-label="현재 위치" className={styles.breadcrumb}>
        <Link href={`/operations?status=${status}`}>신청 목록</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{OPERATION_APPLICATION.applicationNumber}</span>
      </nav>

      <header className={styles.detailHeading}>
        <div>
          <span className={styles.statusBadge}>{stage.label}</span>
          <h1>{OPERATION_APPLICATION.product.name}</h1>
          <p>{OPERATION_APPLICATION.applicationNumber}</p>
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
                alt={`${OPERATION_APPLICATION.product.name} 제품 이미지`}
                fill
                priority
                sizes="(min-width: 900px) 220px, 42vw"
                src={OPERATION_APPLICATION.product.image}
              />
            </div>
            <div className={styles.detailProductCopy}>
              <p>제작 제품</p>
              <h2>{OPERATION_APPLICATION.product.name}</h2>
              <span>
                원제품 · {OPERATION_APPLICATION.sourceProduct.name}
              </span>
              <KeyValueList
                className={styles.compactKeyValues}
                items={[
                  {
                    label: hasConfirmedInspection ? "확정 제작비" : "예상 제작비",
                    value: formatKrw(displayedPriceKrw),
                  },
                  {
                    label: "예상 기간",
                    value: displayedDuration,
                  },
                  {
                    label: hasConfirmedInspection
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
                    value: OPERATION_APPLICATION.customer.name,
                  },
                  {
                    label: "연락처",
                    value: OPERATION_APPLICATION.customer.phone,
                  },
                  {
                    label: "수거 일정",
                    value: `${OPERATION_APPLICATION.pickupDateLabel} ${OPERATION_APPLICATION.pickupTimeLabel}`,
                  },
                  {
                    label: "수거 주소",
                    value: `${OPERATION_APPLICATION.customer.address} ${OPERATION_APPLICATION.customer.addressDetail}`,
                  },
                ]}
              />
            </Card>

            <Card className={styles.infoCard} tone="outline">
              <h2>실물 검수 기준</h2>
              <p className={styles.inspectionReason}>
                {hasConfirmedInspection
                  ? OPERATION_APPLICATION.expertInspection.reason
                  : "제품 입고 후 장인이 원단 상태와 실제 제작 범위를 확인합니다."}
              </p>
              <KeyValueList
                className={styles.compactKeyValues}
                dividers
                items={[
                  {
                    label: "검수 결과",
                    value: hasConfirmedInspection
                      ? "조건 변경 · 고객 승인 완료"
                      : status === "EXPERT_INSPECTION"
                        ? "장인 실물 검수 진행 중"
                        : "제품 입고 후 진행",
                  },
                  {
                    label: "검수일",
                    value: hasConfirmedInspection
                      ? OPERATION_APPLICATION.expertInspection.inspectedAt
                      : "미정",
                  },
                  {
                    label: hasConfirmedInspection
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
              const statusIndex = OPERATION_STATUSES.indexOf(status);
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
                <ButtonLink
                  fullWidth
                  href={operationDetailHref(transition.targetStatus)}
                  size="large"
                >
                  {transition.label}
                </ButtonLink>
                <small>
                  {transition.mode === "inspection-fixture"
                    ? "실물 검수 API 미연결 · 승인 완료 Fixture 반영"
                    : "v2 lifecycle 명령을 화면 상태로 시연"}
                </small>
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
