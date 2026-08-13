import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { ButtonLink } from "@/components/ui/Button";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { DemoStatePanel } from "./DemoStatePanel";
import { RecycleGauge } from "./RecycleGauge";
import styles from "./analysis-design.module.css";
import type { DemoState } from "./types";

type AnalysisResultScreenProps = {
  ineligible?: boolean;
  state: DemoState;
};

function LimitedAnalysis() {
  return (
    <div className={styles.analysisContent}>
      <RecycleGauge grade="C" value={18} />

      <section className={styles.limitedCopy}>
        <h1>원단 손상이 커서 리폼 제작이 어려워요</h1>
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
        href="/"
        size="small"
        variant="ghost"
      >
        홈으로 돌아가기
      </ButtonLink>
    </div>
  );
}

export function AnalysisResultScreen({
  ineligible = false,
  state,
}: AnalysisResultScreenProps) {
  const isLimited = ineligible || state === "limited";

  if (
    state !== "normal" &&
    state !== "limited"
  ) {
    return (
      <AppShell
        header={
          <PageHeader
            backHref="/submissions/demo"
            title="원단 재활용 가능률"
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

  if (isLimited) {
    return (
      <AppShell
        header={
          <PageHeader
            backHref="/submissions/demo"
            title="원단 재활용 가능률"
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
          backHref="/submissions/demo"
          title="원단 재활용 가능률"
        />
      }
    >
      <div className={styles.analysisContent}>
        <RecycleGauge grade="A" value={72} />

        <div className={styles.analysisDetails}>
          <KeyValueList
            items={[
              {
                label: "정품 신호",
                value: "별도 판정 없음",
              },
              {
                label: "신청 상태",
                value: "진행 가능",
              },
              {
                label: "원단 상태",
                value: "양호(경미한 마모)",
              },
              {
                label: "활용 가능 부위",
                value: "전면 가죽 / 손잡이",
              },
              {
                label: "제작 가능 제품",
                value: "지갑 / 파우치 / 키링",
              },
            ]}
          />
        </div>

        <aside className={styles.contractNotice}>
          <strong>사진 기반 사전 분석</strong>
          <p>
            AI는 정품 여부를 확정하지 않습니다. 현재 값은
            NOT_EVALUATED로 신청 진행이 가능하며, REVIEW_REQUIRED가 반환되면
            정품 판정이 아닌 추가 확인 신호로 처리되어 수동 검토 전까지
            신청이 보류됩니다.
          </p>
        </aside>
      </div>
    </AppShell>
  );
}

