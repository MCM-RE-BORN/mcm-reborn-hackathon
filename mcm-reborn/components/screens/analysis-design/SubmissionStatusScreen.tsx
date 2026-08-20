import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { ProgressStepper } from "@/components/ui/ProgressStepper";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { DemoStatePanel } from "./DemoStatePanel";
import { SubmissionLoadingState } from "./SubmissionLoadingState";
import { SubmissionProductSummary } from "./SubmissionProductSummary";
import styles from "./analysis-design.module.css";
import type { DemoState } from "./types";

type SubmissionStatusScreenProps = {
  analysisId?: string;
  state: DemoState;
};

export function SubmissionStatusScreen({
  analysisId,
  state,
}: SubmissionStatusScreenProps) {
  if (state !== "normal") {
    if (state === "loading") {
      return (
        <AppShell
          header={<PageHeader backHref="/products/new" title="접수 현황" />}
        >
          <div className={styles.statePage}>
            <SubmissionLoadingState />
          </div>
        </AppShell>
      );
    }

    const action =
      state === "limited"
        ? {
            href: "/products/new",
            label: "사진 보완하기",
          }
        : state === "permission"
          ? {
              href: "/login",
              label: "로그인으로 이동",
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
          {state === "limited" ? (
            <StatusPanel
              action={
                <ButtonLink fullWidth href="/products/new">
                  보완 사진 다시 등록하기
                </ButtonLink>
              }
              description="정면, 후면, 상단, 하단, 좌측면, 우측면 중 안내된 사진을 더 선명하게 다시 등록해 주세요. 사진을 보완해 제출하면 사전 분석을 이어갈 수 있어요."
              title="사진 보완 요청이 도착했어요"
              tone="permission"
            />
          ) : (
            <DemoStatePanel
              actionHref={action.href}
              actionLabel={action.label}
              context="submission"
              state={state}
            />
          )}
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
          <span className={styles.eyebrow}>AI PRE-CHECK COMPLETE</span>
          <h2>AI 사전 분석이 완료되었어요</h2>
          <p>
            접수한 사진과 제품 정보로 원단 상태를 확인했습니다. 결과를
            확인한 뒤 추천 디자인으로 이어갈 수 있어요.
          </p>
        </section>

        <ProgressStepper
          currentIndex={2}
          items={["접수", "분석", "결과"]}
        />

        <SubmissionProductSummary />

        <Card padding="regular" tone="surface">
          <div className={styles.statusCardHeader}>
            <div>
              <span className={styles.cardLabel}>접수 번호</span>
              <strong>{analysisId ?? "분석 접수 정보"}</strong>
            </div>
            <span className={styles.statusBadge}>분석 완료</span>
          </div>
        </Card>

        <Section
          description="제출 사진과 제품 정보를 기준으로 생성한 사전 분석 요약입니다."
          title="접수 정보"
        >
          <KeyValueList
            dividers
            items={[
              { label: "접수 상태", value: "분석 완료" },
              { label: "사진 품질", value: "분석에 적합" },
              {
                label: "사진 사전 적합성",
                value: "주문 적합성은 AI 분석 결과에서 확인",
              },
              { label: "다음 단계", value: "결과 확인" },
            ]}
          />
        </Section>

        <aside className={styles.contractNotice}>
          <strong>사진 사전 확인 안내</strong>
          <p>
            이 결과는 사진을 바탕으로 한 주문 적합성 예상이며 공식 정품
            판정이 아닙니다. 결제와 주문 후 제품을 수거하면 MCM 공식 장인이
            실물을 최종 확인합니다.
          </p>
        </aside>
      </div>
    </AppShell>
  );
}
