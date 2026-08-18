import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { ButtonLink } from "@/components/ui/Button";
import { DEMO_SCENARIO, formatKrw } from "@/data/demo-scenario";
import { DemoStatePanel } from "./DemoStatePanel";
import styles from "./analysis-design.module.css";
import type { DemoState } from "./types";

type RecommendationScreenProps = {
  state: DemoState;
};

function RecommendationHeader() {
  return (
    <div className={styles.recommendationHeader}>
      <PageHeader
        backHref="/submissions/demo/analysis"
        description="사진 기반 예상 재활용률·기간·제작 제약을 비교해보세요."
        title="추천 디자인"
      />
    </div>
  );
}

export function RecommendationScreen({ state }: RecommendationScreenProps) {
  const header = <RecommendationHeader />;

  if (state !== "normal") {
    return (
      <AppShell header={header}>
        <div className={styles.statePage}>
          <DemoStatePanel
            actionHref={
              state === "limited"
                ? "/submissions/demo/ineligible"
                : "/submissions/demo/analysis"
            }
            actionLabel={
              state === "limited" ? "접수 불가 안내 보기" : "분석 결과로 돌아가기"
            }
            context="recommendation"
            state={state}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      contentWidth="full"
      footer={
        <StickyActionBar>
          <ButtonLink
            fullWidth
            href="/submissions/demo/designs/passport-wallet"
          >
            선택한 디자인 3D 목업 보기
          </ButtonLink>
        </StickyActionBar>
      }
      header={header}
    >
      <div className={styles.recommendationViewport}>
        <ul aria-label="AI 추천 디자인 목록" className={styles.recommendationTrack}>
          {DEMO_SCENARIO.recommendations.map((item, index) => {
            const cardContent = (
              <>
                <span className={styles.productImage}>
                  <Image
                    alt={`${item.name} 예상 디자인`}
                    fill
                    loading={index < 4 ? "eager" : "lazy"}
                    sizes="(max-width: 360px) calc(100vw - 40px), (max-width: 402px) 50vw, 168px"
                    src={item.image}
                  />
                  {item.recommended ? (
                    <span className={styles.recommendationBadge}>AI 추천 1순위</span>
                  ) : null}
                </span>
                <span className={styles.productName}>{item.name}</span>
                <span className={styles.recommendationMetrics}>
                  <span>예상 재활용 {item.expectedReuseRate}%</span>
                  <span>{item.estimatedDuration}</span>
                  <strong>{formatKrw(item.priceKrw)}</strong>
                </span>
                <span className={styles.recommendationConstraint}>
                  {item.constraint}
                </span>
              </>
            );

            return (
              <li key={item.id}>
                {"detailHref" in item ? (
                  <Link
                    aria-current="true"
                    className={`${styles.productCard} ${styles.productCardSelected}`}
                    href={item.detailHref}
                  >
                    {cardContent}
                  </Link>
                ) : (
                  <article className={styles.productCard}>{cardContent}</article>
                )}
              </li>
            );
          })}
        </ul>
        <p className={styles.recommendationNotice}>
          추천 순서와 수치는 사진 기반 예상값입니다. 주문 후 실물 검수에서
          최종 디자인·견적·제작 기간이 달라질 수 있어요.
        </p>
      </div>
    </AppShell>
  );
}
