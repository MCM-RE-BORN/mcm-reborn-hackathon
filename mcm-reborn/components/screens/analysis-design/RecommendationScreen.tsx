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
  type RecommendationCategory,
} from "./recommendation-catalog";
import styles from "./analysis-design.module.css";
import type { DemoState } from "./types";
import {
  customerFetch,
  readImageUrl,
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

  const visibleProducts = useMemo(
    () => (products ?? []).filter((product) => matchesCategory(product, category)),
    [category, products],
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
          AI 분석 결과와 제품 카탈로그에서 제작 가능한 품목만 표시됩니다.
        </p>
        {visibleProducts.length === 0 ? (
          <StatusPanel
            description="현재 분석 결과와 일치하는 제품군이 없습니다. 다른 제품군을 선택해 주세요."
            title="추천 제품이 없습니다"
            tone="empty"
          />
        ) : (
          <ul
            aria-label={`${RECOMMENDATION_CATEGORIES.find((item) => item.id === category)?.label} 추천 디자인 목록`}
            className={styles.recommendationTrack}
          >
            {visibleProducts.map((item, index) => {
              const image = readImageUrl(item.listImage);
              const selectable = item.code === "REBORN_PASSPORT_WALLET";
              const cardContent = (
                <>
                  <span className={styles.productImage}>
                    <Image
                      alt={`${item.name} 예상 디자인`}
                      fill
                      loading={index < 4 ? "eager" : "lazy"}
                      sizes="(max-width: 402px) 42vw, 168px"
                      src={image}
                    />
                  </span>
                  <span className={styles.productName}>{item.name}</span>
                </>
              );
              return (
                <li key={item.id}>
                  {selectable ? (
                    <Link
                      aria-label={`${item.name} 선택하고 3D 목업 확인하기`}
                      className={`${styles.productCard} ${styles.productCardSelectable}`}
                      href={`/submissions/demo/designs/passport-wallet?analysisId=${analysisId}&productId=${item.id}`}
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
        )}
        <p className={styles.recommendationNotice}>
          추천 품목은 사진 기반 AI 예상 결과입니다. 주문 후 실물 검수에서 최종
          디자인·견적·제작 기간이 달라질 수 있어요.
        </p>
      </div>
    </AppShell>
  );
}

function matchesCategory(product: CustomerProduct, category: RecommendationCategory) {
  if (category === "travel") {
    return product.code === "REBORN_PASSPORT_WALLET";
  }
  if (category === "wallet") {
    return product.code === "REBORN_CARD_WALLET";
  }
  if (category === "keyring") {
    return product.code === "REBORN_KEYRING";
  }
  return product.code === "REBORN_NAME_TAG";
}
