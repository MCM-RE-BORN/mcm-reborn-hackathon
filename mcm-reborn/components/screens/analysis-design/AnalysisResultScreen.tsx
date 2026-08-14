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
  ineligibleReason?: "quality" | "review";
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
            : "수동 검토가 필요해 신청이 보류됐어요"}
        </h2>
        <p>
          {isQualityIssue
            ? "제품 전체와 손상 부위가 선명하게 보이지 않아 IMAGE_QUALITY_INSUFFICIENT 오류가 반환됐습니다. 이 결과는 정품·가품 판정이나 소재 등급이 아닙니다. 밝은 곳에서 흔들림 없이 다시 촬영해 주세요."
            : "REVIEW_REQUIRED는 정품·가품 판정이 아니라 추가 확인이 필요하다는 신호입니다. PENDING 수동 검토 건만 생성되며, 검토 전에는 신청·결제 레코드를 만들지 않습니다."}
        </p>
      </section>

      <KeyValueList
        dividers
        items={
          isQualityIssue
            ? [
                { label: "오류 코드", value: "IMAGE_QUALITY_INSUFFICIENT" },
                { label: "품질 상태", value: "RECAPTURE_REQUIRED" },
                { label: "다음 행동", value: "사진 재촬영" },
                { label: "신청 생성", value: "분석 전 단계" },
              ]
            : [
                { label: "정품 신호", value: "REVIEW_REQUIRED" },
                { label: "수동 검토", value: "PENDING" },
                { label: "다음 행동", value: "AWAIT_MANUAL_REVIEW" },
                { label: "신청 생성", value: "차단됨" },
              ]
        }
      />

      <aside className={styles.contractNotice}>
        <strong>예외 상태 안내</strong>
        <p>
          사진 품질 미달은 재촬영으로, 수동 검토 신호는 검토 대기로 각각
          처리합니다. 두 상태 모두 C등급 소재 손상 결과와 구분됩니다.
        </p>
      </aside>

      <ButtonLink fullWidth href="/products/new">
        {isQualityIssue ? "사진 다시 등록하기" : "다른 제품 등록하기"}
      </ButtonLink>
      <ButtonLink
        className={styles.centeredLink}
        href={
          isQualityIssue
            ? "/submissions/demo/ineligible"
            : "/submissions/demo/ineligible?reason=quality"
        }
        size="small"
        variant="ghost"
      >
        {isQualityIssue ? "수동 검토 예시 보기" : "사진 품질 미달 예시 보기"}
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
