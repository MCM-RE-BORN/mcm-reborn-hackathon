"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { DemoStatePanel } from "./DemoStatePanel";
import {
  RECOMMENDATION_CATEGORIES,
  RECOMMENDATION_PRODUCTS,
  type RecommendationCategory,
} from "./recommendation-catalog";
import styles from "./analysis-design.module.css";
import type { DemoState } from "./types";
import {
  customerFetch,
  type CustomerProduct,
} from "../order-certificate/customer-client";

type RecommendationScreenProps = {
  analysisId?: string;
  category: RecommendationCategory;
  state: DemoState;
};

type ProductPage = {
  items: CustomerProduct[];
  totalElements: number;
};

const RECOMMENDATION_REASON_LABELS: Record<string, string> = {
  INSUFFICIENT_AREA: "재사용 가능 면적 부족",
  LONG_STRIP_AVAILABLE: "긴 재단면 확보",
  LOW_DAMAGE_REGION_AVAILABLE: "손상이 적은 영역 확보",
  PATTERN_VISIBILITY: "원제품 패턴 보존",
  SUFFICIENT_AREA: "재사용 면적 충분",
  USES_SMALL_REMNANTS: "자투리 소재 활용",
};

function RecommendationHeader({
  analysisId,
  category,
}: Pick<RecommendationScreenProps, "analysisId" | "category">) {
  return (
    <div className={styles.recommendationHeader}>
      <PageHeader
        backHref={analysisId ? `/submissions/demo/analysis?analysisId=${analysisId}` : "/products/new"}
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
            href={`/submissions/demo/designs?category=${item.id}${analysisId ? `&analysisId=${analysisId}` : ""}`}
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
  analysisId,
  category,
  state,
}: RecommendationScreenProps) {
  const [products, setProducts] = useState<CustomerProduct[] | null>(null);
  const [requestError, setRequestError] = useState(false);
  const header = <RecommendationHeader analysisId={analysisId} category={category} />;

  useEffect(() => {
    if (state !== "normal" || !analysisId) {
      return;
    }
    let cancelled = false;
    customerFetch<ProductPage>(
      `/api/v2/products?analysisId=${encodeURIComponent(analysisId)}&size=100`,
    )
      .then((response) => {
        if (!cancelled) {
          setProducts(response.items);
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
  }, [analysisId, state]);

  const eligibleProducts = useMemo(
    () =>
      (products ?? []).filter(
        (product) => product.recommendation?.eligible === true,
      ),
    [products],
  );
  const productByCode = useMemo(
    () =>
      new Map(
        (products ?? []).flatMap((product) =>
          product.code ? [[product.code, product] as const] : [],
        ),
      ),
    [products],
  );
  const visibleProducts = useMemo(
    () => RECOMMENDATION_PRODUCTS[category],
    [category],
  );

  if (state !== "normal") {
    return (
      <AppShell header={header}>
        <div className={styles.statePage}>
          <DemoStatePanel
            actionHref={analysisId ? `/submissions/demo/analysis?analysisId=${analysisId}` : "/products/new"}
            actionLabel="분석 결과로 돌아가기"
            context="recommendation"
            state={state}
          />
        </div>
      </AppShell>
    );
  }

  if (requestError || !analysisId) {
    return (
      <AppShell header={header}>
        <div className={styles.statePage}>
          <DemoStatePanel
            actionHref="/products/new"
            actionLabel="제품 사진 다시 등록하기"
            context="recommendation"
            state="error"
          />
        </div>
      </AppShell>
    );
  }

  if (!products) {
    return (
      <AppShell header={header}>
        <div className={styles.statePage}>
          <StatusPanel
            description="Supabase에 저장된 추천 결과와 제품 카탈로그를 불러오고 있습니다."
            title="추천 디자인을 준비하고 있어요"
            tone="loading"
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell contentWidth="full" header={header}>
      <div className={styles.recommendationViewport}>
        <p className={styles.recommendationGradeNotice}>
          전체 디자인 후보를 둘러보고, AI 분석 근거가 있는 품목의 우선순위와
          제작 가능 여부를 함께 확인하세요.
        </p>
        {products.length === 0 ? (
          <StatusPanel
            description="현재 분석 결과로는 디자인 후보를 안내할 수 없습니다. 분석 결과를 다시 확인해 주세요."
            title="추천 디자인을 표시할 수 없어요"
            tone="empty"
          />
        ) : (
          <ul
            aria-label={`${RECOMMENDATION_CATEGORIES.find((item) => item.id === category)?.label} 추천 디자인 목록`}
            className={styles.recommendationTrack}
          >
            {visibleProducts.map((item, index) => {
              const product = item.productCode
                ? productByCode.get(item.productCode)
                : undefined;
              const recommendation = product?.recommendation;
              const rank = product
                ? eligibleProducts.findIndex(
                    (candidate) => candidate.id === product.id,
                  ) + 1
                : 0;
              const isEligible = recommendation?.eligible === true;
              const mockupAvailable = Boolean(
                item.detailHref &&
                  product?.code === "REBORN_PASSPORT_WALLET" &&
                  isEligible,
              );
              const mockupHref = product
                ? `/submissions/demo/designs/passport-wallet?analysisId=${encodeURIComponent(analysisId)}&productId=${encodeURIComponent(product.id)}`
                : undefined;
              const reasonLabels = (recommendation?.reasonCodes ?? [])
                .map((code) => RECOMMENDATION_REASON_LABELS[code])
                .filter((label): label is string => Boolean(label));
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
                    {rank > 0 ? (
                      <span className={styles.recommendationBadge}>
                        AI 추천 {rank}위
                      </span>
                    ) : null}
                    {mockupAvailable ? (
                      <span aria-hidden="true" className={styles.productHoverLabel}>
                        맞춤 3D 목업 보기
                      </span>
                    ) : null}
                  </span>
                  <span className={styles.productName}>{item.name}</span>
                  {recommendation ? (
                    <>
                      <span className={styles.recommendationMetrics}>
                        <strong>
                          {isEligible
                            ? `적합도 ${recommendation.score}점`
                            : "제작 기준 검토 필요"}
                        </strong>
                        <span>
                          {reasonLabels.length > 0
                            ? reasonLabels.join(" · ")
                            : "분석 결과와 제작 기준을 확인하고 있어요"}
                        </span>
                      </span>
                      <span className={styles.recommendationConstraint}>
                        필요 면적 {product?.requiredAreaCm2?.toLocaleString("ko-KR") ?? "-"}cm²
                        · 예상 {product?.estimatedDuration ?? "확인 중"}
                      </span>
                    </>
                  ) : (
                    <span className={styles.recommendationConstraint}>
                      디자인 탐색 후보 · 세부 제작 조건은 실물 검수 후 확정
                    </span>
                  )}
                </>
              );
              return (
                <li key={item.id}>
                  {mockupAvailable && mockupHref ? (
                    <Link
                      aria-label={`${item.name} 선택하고 맞춤 3D 목업 확인하기`}
                      className={`${styles.productCard} ${styles.productCardCandidate}`}
                      href={mockupHref}
                    >
                      {cardContent}
                    </Link>
                  ) : (
                    <article className={styles.productCard}>
                      {cardContent}
                    </article>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className={styles.recommendationNotice}>
          AI 순위·적합도는 제품 카탈로그와 사진 분석을 결합한 예상치입니다. 그 외
          디자인 탐색 후보는 시각 참고용이며, 주문 후 실물 검수에서 최종
          디자인·견적·제작 기간이 달라질 수 있어요.
        </p>
      </div>
    </AppShell>
  );
}
