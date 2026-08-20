"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { formatApiDate, formatKrw } from "@/lib/formatters";
import type { DemoState } from "./demo-state";
import { DemoStatePanel } from "./DemoStatePanel";
import {
  applicationStatusToOrderStage,
  customerFetch,
  readImageUrl,
  type CustomerAnalysisListItem,
  type CustomerAnalysisPage,
  type CustomerApplicationPage,
  type CustomerApplicationSummary,
} from "./customer-client";
import styles from "./order-certificate.module.css";

type OrdersListScreenProps = {
  state: Extract<
    DemoState,
    "normal" | "loading" | "empty" | "error" | "permission"
  >;
  view: "analyses" | "applications";
};

export function OrdersListScreen({ state, view }: OrdersListScreenProps) {
  const [applications, setApplications] = useState<
    CustomerApplicationSummary[] | null
  >(null);
  const [analyses, setAnalyses] = useState<CustomerAnalysisListItem[] | null>(
    null,
  );
  const [requestError, setRequestError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let loading = false;
    let firstLoad = true;
    async function loadApplications() {
      if (loading || document.visibilityState !== "visible") {
        return;
      }
      loading = true;
      const initialLoad = firstLoad;
      firstLoad = false;
      try {
        const [applicationResponse, analysisResponse] = await Promise.all([
          customerFetch<CustomerApplicationPage>(
            "/api/v2/applications?size=50",
          ),
          customerFetch<CustomerAnalysisPage>("/api/v2/analyses?size=50"),
        ]);
        if (!cancelled) {
          setApplications(applicationResponse.items);
          setAnalyses(analysisResponse.items);
          setRequestError(false);
        }
      } catch {
        if (!cancelled && initialLoad) {
          setRequestError(true);
        }
      } finally {
        loading = false;
      }
    }
    void loadApplications();
    const pollId = window.setInterval(() => void loadApplications(), 3000);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, []);

  return (
    <AppShell
      footer={<BottomNav active="orders" />}
      header={
        <PageHeader title={view === "analyses" ? "진단 내역" : "신청 내역"} />
      }
    >
      {state !== "normal" ? (
        <div className={styles.stateInset}>
          <DemoStatePanel
            emptyDescription="아직 접수된 업사이클링 신청이 없습니다."
            retryHref="/orders"
            state={state}
            subject="신청 내역"
          />
        </div>
      ) : requestError ? (
        <div className={styles.stateInset}>
          <DemoStatePanel
            emptyDescription="신청 내역을 불러오지 못했습니다."
            retryHref="/orders"
            state="error"
            subject="신청 내역"
          />
        </div>
      ) : applications === null || analyses === null ? (
        <div className={styles.stateInset}>
          <StatusPanel
            description="정보를 불러오고 있습니다."
            title="진단 및 신청 내역을 확인하고 있어요"
            tone="loading"
          />
        </div>
      ) : (
        <section
          aria-labelledby="orders-list-heading"
          className={styles.ordersListLayout}
        >
          <h2 className={styles.visuallyHidden} id="orders-list-heading">
            진단 및 신청 내역
          </h2>

          <nav aria-label="내역 종류" className={styles.orderHistoryTabs}>
            <Link
              aria-current={view === "applications" ? "page" : undefined}
              className={
                view === "applications" ? styles.orderHistoryTabActive : ""
              }
              href="/orders?view=applications"
            >
              신청 내역 <span>{applications.length}</span>
            </Link>
            <Link
              aria-current={view === "analyses" ? "page" : undefined}
              className={view === "analyses" ? styles.orderHistoryTabActive : ""}
              href="/orders?view=analyses"
            >
              진단 내역 <span>{analyses.length}</span>
            </Link>
          </nav>

          {view === "applications" && applications.length === 0 ? (
            <div className={styles.stateInset}>
              <DemoStatePanel
                emptyDescription="아직 접수된 업사이클링 신청이 없습니다."
                retryHref="/products/new"
                state="empty"
                subject="신청 내역"
              />
            </div>
          ) : view === "analyses" && analyses.length === 0 ? (
            <div className={styles.stateInset}>
              <DemoStatePanel
                emptyDescription="아직 완료된 AI 진단 결과가 없습니다."
                retryHref="/products/new"
                state="empty"
                subject="진단 내역"
              />
            </div>
          ) : view === "analyses" ? (
            <ul className={styles.ordersList}>
              {analyses.map((analysis) => (
                <AnalysisListItem
                  analysis={analysis}
                  hasApplication={applications.some(
                    (application) => application.analysisId === analysis.id,
                  )}
                  key={analysis.id}
                />
              ))}
            </ul>
          ) : (
            <ul className={styles.ordersList}>
              {applications.map((application) => (
                <ApplicationListItem
                  application={application}
                  key={application.id}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </AppShell>
  );
}

function AnalysisListItem({
  analysis,
  hasApplication,
}: {
  analysis: CustomerAnalysisListItem;
  hasApplication: boolean;
}) {
  return (
    <li>
      <Link
        aria-label={`${sourceCategoryLabel(analysis.sourceCategory)} AI 분석 결과 보기`}
        className={styles.ordersListCard}
        href={`/submissions/demo/analysis?analysisId=${encodeURIComponent(analysis.id)}&from=orders-analyses`}
      >
        <div className={styles.ordersListCardMeta}>
          <span>{hasApplication ? "신청 완료" : "AI 분석 완료"}</span>
          <small>{formatApiDate(analysis.createdAt)}</small>
        </div>

        <div className={styles.ordersListProductRow}>
          <span className={styles.ordersListThumbnail}>
            <Image
              alt="등록한 원제품 대표 이미지"
              fill
              sizes="52px"
              src="/assets/mvp-beta/source-backpack-front.webp"
            />
          </span>
          <span className={styles.ordersListProductCopy}>
            <strong>{sourceCategoryLabel(analysis.sourceCategory)} AI 분석</strong>
            <span>상태 등급 {analysis.conditionGrade}</span>
            <span>예상 재활용 가능률 {analysis.estimatedReusableMaterialRate}%</span>
          </span>
          <strong className={styles.ordersListPrice}>
            {analysis.estimateMeta.confidencePercent}%
          </strong>
        </div>

        <span className={styles.ordersListCardAction}>
          AI 분석 결과 보기
          <Image
            alt=""
            aria-hidden="true"
            height={10}
            src="/assets/mvp-beta/icon-chevron-right.svg"
            width={12}
          />
        </span>
      </Link>
    </li>
  );
}

function ApplicationListItem({
  application,
}: {
  application: CustomerApplicationSummary;
}) {
  const stage = applicationStatusToOrderStage(application.status);
  const image = readImageUrl(application.product.listImage);
  const applicationHref = `/orders/demo?applicationId=${encodeURIComponent(application.id)}`;
  return (
    <li>
      <article className={styles.ordersListCard}>
        <div className={styles.ordersListCardMeta}>
          <span>{stageLabel(stage)}</span>
          <small>{application.applicationNumber}</small>
        </div>

        <div className={styles.ordersListProductRow}>
          <span className={styles.ordersListThumbnail}>
            <Image
              alt={`${application.product.name} 제품 이미지`}
              fill
              sizes="52px"
              src={image}
            />
          </span>
          <span className={styles.ordersListProductCopy}>
            <strong>{application.product.name}</strong>
            <span>신청일 {formatApiDate(application.createdAt)}</span>
            <span>수량: 1개</span>
          </span>
          <strong className={styles.ordersListPrice}>
            {formatKrw(application.amount.amount)}
          </strong>
        </div>

        <div className={styles.ordersListCardActions}>
          {stage === "completed" ? (
            <Link
              className={styles.ordersListCertificateAction}
              href={`/certificates/demo?applicationId=${encodeURIComponent(application.id)}&state=issued`}
            >
              인증서 보러가기
            </Link>
          ) : null}
          <Link
            aria-label={`${application.product.name} 신청 상세 보기`}
            className={styles.ordersListCardAction}
            href={applicationHref}
          >
            신청 상세 보기
            <Image
              alt=""
              aria-hidden="true"
              height={10}
              src="/assets/mvp-beta/icon-chevron-right.svg"
              width={12}
            />
          </Link>
        </div>
      </article>
    </li>
  );
}

function stageLabel(stage: ReturnType<typeof applicationStatusToOrderStage>) {
  return {
    canceled: "신청 취소",
    completed: "완료",
    "change-required": "변경 조건 확인 필요",
    inspection: "실물 검수 중",
    pickup: "접수 완료",
    "production-ready": "실물 검수 완료 · 제작 준비",
    production: "제작 중",
    quality: "품질 확인 중",
    shipping: "배송 중",
  }[stage];
}

function sourceCategoryLabel(category: string) {
  return {
    BACKPACK: "백팩",
    BOSTON_BAG: "보스턴백",
    BUCKET_BAG: "버킷백",
    CLUTCH_POUCH: "클러치·파우치",
    SHOULDER_CROSSBODY: "숄더·크로스백",
    TOP_HANDLE: "탑핸들백",
    TOTE_SHOPPER: "토트·쇼퍼백",
    TRAVEL_LUGGAGE: "트래블·러기지",
    UNKNOWN_BAG: "가방",
    WEEKENDER_DUFFLE: "위켄더·더플백",
  }[category] ?? "가방";
}
