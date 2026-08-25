"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { ButtonLink } from "@/components/ui/Button";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { DemoStatePanel } from "./DemoStatePanel";
import { SubmissionProductSummary } from "./SubmissionProductSummary";
import { RecycleGauge } from "./RecycleGauge";
import {
  isApiFallbackAnalysis,
  visibleAnalysisWarnings,
} from "./analysisFallback";
import styles from "./analysis-design.module.css";
import type { DemoState } from "./types";
import {
  customerFetch,
  type CustomerAnalysis,
} from "../order-certificate/customer-client";

const MATERIAL_LABELS: Record<string, string> = {
  COATED_CANVAS: "코티드 캔버스",
  FABRIC: "패브릭",
  LEATHER: "가죽",
  MIXED: "혼합 소재",
  NYLON: "나일론",
  UNKNOWN: "확인 필요",
};

function analysisModeLabel(analysis: CustomerAnalysis) {
  if (analysis.modeUsed === "LIVE" && analysis.provider.name === "OPENAI") {
    return "OpenAI 실사진 분석";
  }
  if (analysis.modeUsed === "SEEDED_ESTIMATE") {
    return "재현 가능한 예상 분석";
  }
  return "데모 기준 예상 분석";
}

type AnalysisResultScreenProps = {
  analysisId?: string;
  backHref?: string;
  ineligibleReason?: "precheck" | "quality";
  state: DemoState;
};

function IneligibleAnalysis({
  reason,
}: {
  reason: NonNullable<AnalysisResultScreenProps["ineligibleReason"]>;
}) {
  const isQualityIssue = reason === "quality";
  return (
    <div className={styles.analysisContent}>
      <section className={styles.limitedCopy}>
        <h2>
          {isQualityIssue
            ? "사진 품질을 확인할 수 없어요"
            : "사진만으로 서비스 대상을 확인하기 어려워요"}
        </h2>
        <p>
          {isQualityIssue
            ? "제품 전체와 손상 부위가 선명하게 보이지 않아요. 밝은 곳에서 흔들림 없이 다시 촬영해 주세요."
            : "현재 사진에서는 제품 식별 정보가 충분히 보이지 않아 주문 적합성을 안내하기 어렵습니다. 이 결과는 정품·가품의 공식 판정이 아닙니다."}
        </p>
      </section>
      <KeyValueList
        dividers
        items={[
          { label: "확인 결과", value: isQualityIssue ? "사진 품질 보완 필요" : "사진 사전 확인 불충분" },
          { label: "다음 행동", value: "사진과 제품 정보 재등록" },
        ]}
      />
      <ButtonLink fullWidth href="/products/new">
        사진 다시 등록하기
      </ButtonLink>
    </div>
  );
}

export function AnalysisResultScreen({
  analysisId,
  backHref = "/products/new",
  ineligibleReason,
  state,
}: AnalysisResultScreenProps) {
  const [analysis, setAnalysis] = useState<CustomerAnalysis | null>(null);
  const [requestError, setRequestError] = useState(false);

  useEffect(() => {
    if (state !== "normal" || !analysisId || ineligibleReason) {
      return;
    }
    let cancelled = false;
    customerFetch<CustomerAnalysis>(`/api/v2/analyses/${analysisId}`)
      .then((response) => {
        if (!cancelled) {
          setAnalysis(response);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRequestError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [analysisId, ineligibleReason, state]);

  if (state !== "normal") {
    return (
      <AppShell header={<PageHeader backHref={backHref} title="AI 예상 재활용률" />}>
        <div className={styles.statePage}>
          <DemoStatePanel
            actionHref="/submissions/demo"
            actionLabel="접수 현황으로 돌아가기"
            context="analysis"
            state={state}
          />
        </div>
      </AppShell>
    );
  }

  if (ineligibleReason) {
    return (
      <AppShell header={<PageHeader backHref={backHref} title="신청 전 확인" />}>
        <IneligibleAnalysis reason={ineligibleReason} />
      </AppShell>
    );
  }

  if (requestError || !analysisId) {
    return (
      <AppShell header={<PageHeader backHref={backHref} title="AI 예상 재활용률" />}>
        <div className={styles.statePage}>
          <DemoStatePanel
            actionHref="/products/new"
            actionLabel="제품 사진 다시 등록하기"
            context="analysis"
            state="error"
          />
        </div>
      </AppShell>
    );
  }

  if (!analysis) {
    return (
      <AppShell header={<PageHeader backHref={backHref} title="AI 예상 재활용률" />}>
        <div className={styles.statePage}>
          <StatusPanel
            description="Supabase에 저장된 분석 결과를 불러오고 있습니다."
            title="AI 분석 결과를 확인하고 있어요"
            tone="loading"
          />
        </div>
      </AppShell>
    );
  }

  const isIneligible = analysis.authenticityPrecheck?.status === "INELIGIBLE";
  if (isIneligible) {
    return (
      <AppShell header={<PageHeader backHref={backHref} title="신청 전 확인" />}>
        <IneligibleAnalysis reason="precheck" />
      </AppShell>
    );
  }

  const conditionSummary = analysis.condition.summary.trim();
  const isApiFallback = isApiFallbackAnalysis(analysis);
  const visibleWarnings = visibleAnalysisWarnings(analysis);

  return (
    <AppShell
      footer={
        <StickyActionBar>
          <ButtonLink fullWidth href={`/submissions/demo/designs?analysisId=${analysisId}`}>
            추천 디자인 보기
          </ButtonLink>
        </StickyActionBar>
      }
      header={<PageHeader backHref={backHref} title="AI 예상 재활용률" />}
    >
      <div className={styles.analysisContent}>
        <RecycleGauge
          grade={analysis.condition.grade}
          value={analysis.estimatedReusableMaterialRate}
        />
        <SubmissionProductSummary />

        <section
          aria-labelledby="analysis-facts-title"
          className={styles.analysisDetails}
        >
          <h2 className={styles.analysisSectionTitle} id="analysis-facts-title">
            분석 정보
          </h2>
          <KeyValueList
            items={[
              {
                label: "사진 사전 적합성",
                value: `주문 가능 · 예상 ${analysis.authenticityPrecheck?.estimatePercent ?? "-"}%`,
              },
              {
                label: "분석 실행 방식",
                value: analysisModeLabel(analysis),
              },
              {
                label: "AI 예상 신뢰도",
                value: `${analysis.estimateMeta?.confidencePercent ?? "-"}%`,
              },
              {
                label: "소재 추정",
                value:
                  MATERIAL_LABELS[analysis.sourceProduct.materialType] ??
                  analysis.sourceProduct.materialType,
              },
              {
                label: "재사용 예상 면적",
                value: `${analysis.estimatedReusableAreaCm2.toLocaleString("ko-KR")}cm²`,
              },
              {
                label: "손상 정도",
                value: `${analysis.condition.overallDamageSeverity}%`,
              },
            ]}
          />
          {isApiFallback ? (
            <small className={styles.analysisFallbackLabel} role="status">
              API오류로 인한 DEMO
            </small>
          ) : null}
        </section>

        {conditionSummary ? (
          <section
            aria-labelledby="analysis-summary-title"
            className={styles.analysisNarrative}
          >
            <h2
              className={styles.analysisSectionTitle}
              id="analysis-summary-title"
            >
              AI 분석 내용
            </h2>
            <p>{conditionSummary}</p>
          </section>
        ) : null}

        <aside className={styles.contractNotice}>
          <strong>사진 기반 사전 분석</strong>
          <p>
            표시된 수치는 제출 사진을 바탕으로 만든 예상치이며 제작 가능성을
            확정하지 않습니다. 주문 후 MCM 공식 장인이 실물을 확인합니다.
          </p>
        </aside>

        {visibleWarnings.length > 0 ? (
          <aside className={styles.contractNotice} role="status">
            <strong>분석 안내</strong>
            {visibleWarnings.map((warning) => (
              <p key={warning.code}>{warning.message}</p>
            ))}
          </aside>
        ) : null}
      </div>
    </AppShell>
  );
}
