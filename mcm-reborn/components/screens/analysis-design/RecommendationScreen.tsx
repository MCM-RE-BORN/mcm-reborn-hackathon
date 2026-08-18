import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { DemoStatePanel } from "./DemoStatePanel";
import {
  RECOMMENDATION_CATEGORIES,
  RECOMMENDATION_PRODUCTS,
  type RecommendationCategory,
} from "./recommendation-catalog";
import styles from "./analysis-design.module.css";
import type { DemoState } from "./types";

type RecommendationScreenProps = {
  category: RecommendationCategory;
  state: DemoState;
};

function RecommendationHeader({
  category,
}: Pick<RecommendationScreenProps, "category">) {
  return (
    <div className={styles.recommendationHeader}>
      <PageHeader
        backHref="/submissions/demo/analysis"
        description="제품을 선택하여 예상 결과물의 3D목업을 확인하세요."
        title="추천 디자인"
      />
      <nav aria-label="추천 제품군" className={styles.productTabs}>
        {RECOMMENDATION_CATEGORIES.map((item) => (
          <Link
            aria-current={item.id === category ? "page" : undefined}
            className={`${styles.productTab} ${
              item.id === category ? styles.productTabActive : ""
            }`}
            href={`/submissions/demo/designs?category=${item.id}`}
            key={item.id}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function RecommendationScreen({
  category,
  state,
}: RecommendationScreenProps) {
  const header = <RecommendationHeader category={category} />;

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
    <AppShell contentWidth="full" header={header}>
      <div className={styles.recommendationViewport}>
        <p className={styles.recommendationGradeNotice}>
          현재 등급(A)에서 제작 가능한 품목만 표시됩니다.
        </p>
        <ul
          aria-label={`${
            RECOMMENDATION_CATEGORIES.find((item) => item.id === category)?.label
          } 추천 디자인 목록`}
          className={styles.recommendationTrack}
        >
          {RECOMMENDATION_PRODUCTS[category].map((item, index) => {
            const cardContent = (
              <>
                <span className={styles.productImage}>
                  <Image
                    alt={`${item.name} 예상 디자인`}
                    fill
                    loading={index < 4 ? "eager" : "lazy"}
                    sizes="(max-width: 402px) 42vw, 168px"
                    src={item.image}
                  />
                </span>
                <span className={styles.productName}>{item.name}</span>
              </>
            );

            return (
              <li key={item.id}>
                {item.detailHref ? (
                  <Link
                    aria-label={`${item.name} 선택하고 3D 목업 확인하기`}
                    className={`${styles.productCard} ${styles.productCardSelectable}`}
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
          추천 품목은 사진 기반 AI 예상 결과입니다. 주문 후 실물 검수에서 최종
          디자인·견적·제작 기간이 달라질 수 있어요.
        </p>
      </div>
    </AppShell>
  );
}
