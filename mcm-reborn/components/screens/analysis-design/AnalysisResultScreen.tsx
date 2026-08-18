import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { ButtonLink } from "@/components/ui/Button";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { DEMO_SCENARIO } from "@/data/demo-scenario";
import { DemoStatePanel } from "./DemoStatePanel";
import { RecycleGauge } from "./RecycleGauge";
import { SubmissionProductSummary } from "./SubmissionProductSummary";
import styles from "./analysis-design.module.css";
import type { DemoState } from "./types";

type AnalysisResultScreenProps = {
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
            : "현재 사진에서는 제품 식별 정보가 충분히 보이지 않아 주문 적합성을 안내하기 어렵습니다. 이 결과는 정품·가품의 공식 판정이 아니며, 좌·우 측면과 후면을 밝은 곳에서 다시 촬영하고 제품 시리얼 번호가 있다면 입력해 주세요."}
        </p>
      </section>

      <KeyValueList
        dividers
        items={
          isQualityIssue
            ? [
                { label: "확인 결과", value: "사진 품질 보완 필요" },
                { label: "부족한 항목", value: "밝기 · 선명도" },
                { label: "다음 행동", value: "사진 재촬영" },
              ]
            : [
                { label: "확인 결과", value: "사진 사전 확인 불충분" },
                { label: "보완할 정보", value: "좌·우 측면 · 후면 · 시리얼 번호" },
                { label: "다음 행동", value: "사진과 식별 정보 재등록" },
              ]
        }
      />

      <aside className={styles.contractNotice}>
        <strong>주문 전 사전 확인</strong>
        <p>
          사진 사전 확인은 주문 가능 여부를 안내하기 위한 예상 단계입니다.
          주문 후 수거된 제품의 공식 확인은 MCM 장인의 실물 검수에서
          이루어집니다.
        </p>
      </aside>

      <ButtonLink fullWidth href="/products/new">
        {isQualityIssue ? "사진 다시 등록하기" : "다른 제품 등록하기"}
      </ButtonLink>
    </div>
  );
}

function LimitedAnalysis() {
  return (
    <div className={styles.analysisContent}>
      <RecycleGauge grade="C" value={18} />

      <section className={styles.limitedCopy}>
        <h2>원단 손상이 커서 리폼 제작이 어려워요</h2>
        <p>
          리폼 기준에 미치지 못한 가죽이라 해도 그 안에 담긴 시간까지
          사라지는 것은 아닙니다. RE:BORN은 성주재단과의 파트너십을 통해
          이런 가죽을 전시와 교육의 자원으로 다시 남깁니다.
        </p>
      </section>

      <aside className={styles.contractNotice}>
        <strong>결과 범위</strong>
        <p>
          이 결과는 소재 재활용 가능성에 대한 사진 기반 예상치이며, 사진
          품질 오류나 정품·가품 판정 결과가 아닙니다.
        </p>
      </aside>

      <ButtonLink fullWidth href="/intro" variant="primary">
        기부 프로그램 알아보기
      </ButtonLink>
      <ButtonLink
        className={styles.centeredLink}
        href="/home"
        size="small"
        variant="ghost"
      >
        홈으로 돌아가기
      </ButtonLink>
    </div>
  );
}

export function AnalysisResultScreen({
  ineligibleReason,
  state,
}: AnalysisResultScreenProps) {
  if (
    state !== "normal" &&
    state !== "limited"
  ) {
    return (
      <AppShell
        header={
          <PageHeader
            backHref="/submissions/demo"
            title="AI 예상 재활용률"
          />
        }
      >
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
      <AppShell
        header={
          <PageHeader
            backHref="/submissions/demo"
            title="신청 전 확인"
          />
        }
      >
        <IneligibleAnalysis reason={ineligibleReason} />
      </AppShell>
    );
  }

  if (state === "limited") {
    return (
      <AppShell
        header={
          <PageHeader
            backHref="/submissions/demo"
            title="AI 예상 재활용률"
          />
        }
      >
        <LimitedAnalysis />
      </AppShell>
    );
  }

  return (
    <AppShell
      footer={
        <StickyActionBar>
          <ButtonLink
            fullWidth
            href="/submissions/demo/designs"
          >
            추천 디자인 보기
          </ButtonLink>
        </StickyActionBar>
      }
      header={
        <PageHeader
          backHref="/products/new"
          title="AI 예상 재활용률"
        />
      }
    >
      <div className={styles.analysisContent}>
        <RecycleGauge
          grade={DEMO_SCENARIO.analysis.conditionGrade}
          value={DEMO_SCENARIO.analysis.expectedReusableMaterialRate}
        />

        <SubmissionProductSummary />

        <div className={styles.analysisDetails}>
          <KeyValueList
            items={[
              {
                label: "사진 사전 적합성",
                value: `주문 가능 · 예상 ${DEMO_SCENARIO.analysis.authenticityPrecheckPercent}%`,
              },
              {
                label: "AI 예상 신뢰도",
                value: `${DEMO_SCENARIO.analysis.estimateConfidencePercent}%`,
              },
              {
                label: "AI 예상 상태",
                value: DEMO_SCENARIO.analysis.conditionSummary,
              },
              {
                label: "활용 가능 부위",
                value: DEMO_SCENARIO.analysis.reusableAreas,
              },
              {
                label: "예상 제약 부위",
                value: DEMO_SCENARIO.analysis.constrainedAreas,
              },
            ]}
          />
        </div>

        <aside className={styles.contractNotice}>
          <strong>사진 기반 사전 분석</strong>
          <p>
            표시된 {DEMO_SCENARIO.analysis.expectedReusableMaterialRate}%는
            제출 사진을 바탕으로 만든 예상치이며 제작 가능성을 확정하지
            않습니다. 결제와 주문 후 MCM 공식 장인이 실물을 확인하며, 최종
            재단 범위·디자인·견적이 달라지면 고객 승인 후 제작을 시작합니다.
          </p>
        </aside>
      </div>
    </AppShell>
  );
}
