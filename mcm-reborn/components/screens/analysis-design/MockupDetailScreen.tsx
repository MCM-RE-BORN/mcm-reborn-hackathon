"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { ButtonLink } from "@/components/ui/Button";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { DemoStatePanel } from "./DemoStatePanel";
import { TextureMockupStudio } from "./TextureMockupStudio";
import {
  customerFetch,
  type CustomerProductDetail,
} from "../order-certificate/customer-client";
import styles from "./analysis-design.module.css";
import type { DemoState } from "./types";

type MockupDetailScreenProps = {
  analysisId?: string;
  productId?: string;
  state: DemoState;
};

const MOCKUP_GALLERY = [
  {
    alt: "RE:BORN 여권지갑 정면 예상 이미지",
    label: "정면",
    src: "/assets/mvp-beta/passport-wallet-front.png",
  },
  {
    alt: "RE:BORN 여권지갑 내부 예상 이미지",
    label: "내부",
    src: "/assets/mvp-beta/passport-wallet-open.png",
  },
  {
    alt: "RE:BORN 여권지갑 후면 예상 이미지",
    label: "후면",
    src: "/assets/mvp-beta/passport-wallet-back.png",
  },
] as const;

function getDesignsHref(analysisId?: string) {
  return analysisId
    ? `/submissions/demo/designs?analysisId=${encodeURIComponent(analysisId)}`
    : "/submissions/demo/designs";
}

export function MockupDetailScreen({ analysisId, productId, state }: MockupDetailScreenProps) {
  const [product, setProduct] = useState<CustomerProductDetail | null>(null);
  const [requestError, setRequestError] = useState(false);

  useEffect(() => {
    if (state !== "normal" || !analysisId || !productId) {
      return;
    }
    let cancelled = false;
    customerFetch<CustomerProductDetail>(
      `/api/v2/products/${productId}?analysisId=${encodeURIComponent(analysisId)}`,
    )
      .then((value) => {
        if (!cancelled) {
          setProduct(value);
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
  }, [analysisId, productId, state]);

  if (state !== "normal") {
    const designsHref = getDesignsHref(analysisId);
    return (
      <AppShell
        header={
          <PageHeader backHref={designsHref} title="3D 목업" />
        }
      >
        <div className={styles.statePage}>
          <DemoStatePanel
            actionHref={
              state === "limited"
                ? "/submissions/demo/ineligible"
                : designsHref
            }
            actionLabel={
              state === "limited" ? "제작 불가 결과 보기" : "추천 디자인으로 돌아가기"
            }
            context="mockup"
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
          href={`/orders/new?analysisId=${analysisId ?? ""}&productId=${productId ?? ""}`}
        >
            이 디자인으로 주문 신청
          </ButtonLink>
        </StickyActionBar>
      }
      header={<PageHeader backHref={getDesignsHref(analysisId)} />}
    >
      {!analysisId || !productId || requestError ? (
        <div className={styles.statePage}>
          <DemoStatePanel
            actionHref={getDesignsHref(analysisId)}
            actionLabel="추천 디자인으로 돌아가기"
            context="mockup"
            state="error"
          />
        </div>
      ) : !product ? (
        <div className={styles.statePage}>
          <StatusPanel
            description="Supabase에 저장된 제품 정보를 불러오고 있습니다."
            title="제품 목업 정보를 준비하고 있어요"
            tone="loading"
          />
        </div>
      ) : (
        <article className={styles.mockupContent}>
          <div className={styles.mockupStage}>
            <TextureMockupStudio analysisId={analysisId} />
          </div>

          <header className={styles.productDetailHeader}>
            <h1>{product.name}</h1>
            <a className={styles.engravingLink} href="#engraving-note">
              각인 옵션 안내
            </a>
          </header>

          <aside className={styles.contractNotice}>
            <strong>3D 목업 안내</strong>
            <p>
              이 목업은 고객이 등록한 원제품 사진을 바탕으로 만든 예상
              3D모델입니다. 주문 후 장인이 실물을 확인하면 소재 배치·재단
              범위·세부 마감이 달라질 수 있으며 변경 조건은 제작 전에 고객에게
              안내합니다.
            </p>
          </aside>

          <section className={styles.productStory}>
            <section aria-labelledby="mockup-gallery-title">
              <h2
                className={styles.productGalleryTitle}
                id="mockup-gallery-title"
              >
                다각도 예시 이미지
              </h2>
              <div className={styles.mockupGallery}>
                {MOCKUP_GALLERY.map((view) => (
                  <figure className={styles.galleryItem} key={view.src}>
                    <Image
                      alt={view.alt}
                      fill
                      sizes="(max-width: 402px) calc(100vw - 40px), 350px"
                      src={view.src}
                    />
                    <figcaption>{view.label}</figcaption>
                  </figure>
                ))}
              </div>
            </section>

            <figure className={styles.productStoryFigure}>
              <div className={styles.productStoryImage}>
                <Image
                  alt="RE:BORN 여권지갑을 펼친 내부 구성"
                  height={770}
                  sizes="(max-width: 402px) calc(100vw - 40px), 350px"
                  src="/assets/mvp-beta/passport-wallet/open-inside.jpg"
                  width={750}
                />
                <span className={styles.productStoryTag}>내부 구성</span>
              </div>
              <figcaption>
                여권과 카드, 지퍼 포켓을 한 번에 정리할 수 있는 내부 구성입니다.
              </figcaption>
            </figure>

            <aside className={styles.engravingNotice} id="engraving-note">
              <strong>각인 옵션 안내</strong>
              <p>
                각인 서비스는 제품 상태와 제작 방식에 따라 제공 여부가 달라질 수
                있습니다. 실물 검수 후 가능한 위치와 크기를 안내합니다.
              </p>
            </aside>
          </section>
        </article>
      )}
    </AppShell>
  );
}
