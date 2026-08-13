import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { ProgressStepper } from "@/components/ui/ProgressStepper";
import { DemoStatePanel } from "./DemoStatePanel";
import styles from "./analysis-design.module.css";
import type { DemoState } from "./types";

type SubmissionStatusScreenProps = {
  state: DemoState;
};

export function SubmissionStatusScreen({
  state,
}: SubmissionStatusScreenProps) {
  if (state !== "normal") {
    const action =
      state === "limited"
        ? {
            href: "/products/new",
            label: "사진 보완하기",
          }
        : {
            href: "/products/new",
            label: "제품 등록으로 돌아가기",
          };

    return (
      <AppShell
        header={
          <PageHeader backHref="/products/new" title="접수 현황" />
        }
      >
        <div className={styles.statePage}>
          <DemoStatePanel
            actionHref={action.href}
            actionLabel={action.label}
            context="submission"
            state={state}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      footer={
        <StickyActionBar>
          <ButtonLink
            fullWidth
            href="/submissions/demo/analysis"
          >
            AI 분석 결과 보기
          </ButtonLink>
        </StickyActionBar>
      }
      header={<PageHeader backHref="/products/new" title="접수 현황" />}
    >
      <div className={styles.submissionContent}>
        <section className={styles.submissionLead}>
          <span className={styles.eyebrow}>ANALYSIS COMPLETE</span>
          <h1>AI 사전 분석이 완료되었어요</h1>
          <p>
            접수한 사진과 제품 정보로 원단 상태를 확인했습니다. 결과를
            확인한 뒤 추천 디자인으로 이어갈 수 있어요.
          </p>
        </section>

        <ProgressStepper
          currentIndex={2}
          items={["접수", "분석", "결과"]}
        />

        <Card padding="regular" tone="surface">
          <div className={styles.statusCardHeader}>
            <div>
              <span className={styles.cardLabel}>접수 번호</span>
              <strong>SUB-DEMO-001</strong>
            </div>
            <span className={styles.statusBadge}>분석 완료</span>
          </div>
        </Card>

        <Section
          description="제출 사진을 기준으로 생성된 데모 분석 요약입니다."
          title="접수 정보"
        >
          <KeyValueList
            dividers
            items={[
              { label: "접수 상태", value: "분석 완료" },
              { label: "사진 품질", value: "ACCEPTABLE" },
              { label: "정품 신호", value: "NOT_EVALUATED" },
              { label: "다음 단계", value: "결과 확인" },
            ]}
          />
        </Section>

        <aside className={styles.contractNotice}>
          <strong>정품 판정 안내</strong>
          <p>
            AI 분석은 정품·가품을 확정하지 않습니다. 현재 접수는 별도 판정
            신호가 없는 상태이며 신청 단계로 진행할 수 있습니다.
          </p>
        </aside>

        <ButtonLink
          className={styles.textAction}
          href="/submissions/demo/ineligible"
          size="small"
          variant="ghost"
        >
          제작 불가 결과 예시 보기
        </ButtonLink>
      </div>
    </AppShell>
  );
}

