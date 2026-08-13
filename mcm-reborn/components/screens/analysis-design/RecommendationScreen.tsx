import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { ButtonLink } from "@/components/ui/Button";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { DemoStatePanel } from "./DemoStatePanel";
import styles from "./analysis-design.module.css";
import type { DemoState, RecommendationCategory } from "./types";

type RecommendationScreenProps = {
  category: RecommendationCategory;
  state: DemoState;
};

type Recommendation = {
  category: Exclude<RecommendationCategory, "keyring">;
  image: string;
  name: string;
};

const TABS: Array<{
  id: RecommendationCategory;
  label: string;
}> = [
  { id: "wallet", label: "지갑" },
  { id: "pouch", label: "파우치" },
  { id: "keyring", label: "키링" },
];

const RECOMMENDATIONS: Recommendation[] = [
  {
    category: "wallet",
    image: "/assets/mvp-beta/recommendation-crossbody-wallet.png",
    name: "L Pina 스터드 크로스바디 월렛",
  },
  {
    category: "wallet",
    image: "/assets/mvp-beta/recommendation-studded-wallet.png",
    name: "S Pina 스터드 장식 비세토스 지갑",
  },
  {
    category: "pouch",
    image: "/assets/mvp-beta/recommendation-card-pouch.png",
    name: "Aren 비세토스 카드 파우치",
  },
  {
    category: "wallet",
    image: "/assets/mvp-beta/recommendation-bifold-wallet.png",
    name: "Aren 비세토스 브라스 플레이트 지갑",
  },
  {
    category: "wallet",
    image: "/assets/mvp-beta/recommendation-passport-wallet.png",
    name: "Ottomar 비세토스 여권 지갑",
  },
  {
    category: "wallet",
    image: "/assets/mvp-beta/recommendation-chain-wallet.png",
    name: "Tracy 비세토스 체인 월렛",
  },
  {
    category: "wallet",
    image: "/assets/mvp-beta/recommendation-card-holder.png",
    name: "Aren 비세토스 카드 홀더",
  },
  {
    category: "pouch",
    image: "/assets/mvp-beta/recommendation-zip-wallet.png",
    name: "Ottomar 비세토스 지퍼 파우치",
  },
];

function RecommendationHeader({
  category,
}: Pick<RecommendationScreenProps, "category">) {
  return (
    <div className={styles.recommendationHeader}>
      <PageHeader
        backHref="/submissions/demo/analysis"
        description="현재 등급(A)의 Figma 시각 데모 후보입니다"
        title="추천 디자인"
      />
      <nav aria-label="추천 품목" className={styles.productTabs}>
        {TABS.map((tab) => {
          const isActive = tab.id === category;

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={[
                styles.productTab,
                isActive ? styles.productTabActive : "",
              ]
                .filter(Boolean)
                .join(" ")}
              href={`/submissions/demo/designs?category=${tab.id}`}
              key={tab.id}
            >
              {tab.label}
            </Link>
          );
        })}
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
              state === "limited" ? "제작 불가 결과 보기" : "분석 결과로 돌아가기"
            }
            context="recommendation"
            state={state}
          />
        </div>
      </AppShell>
    );
  }

  const items =
    category === "wallet"
      ? RECOMMENDATIONS
      : RECOMMENDATIONS.filter(
          (recommendation) => recommendation.category === category,
        );

  if (items.length === 0) {
    return (
      <AppShell header={header}>
        <div className={styles.statePage}>
          <StatusPanel
            action={
              <ButtonLink
                fullWidth
                href="/submissions/demo/designs?category=wallet"
              >
                지갑 추천 보기
              </ButtonLink>
            }
            description="정확한 Figma 제품 이미지가 준비된 추천안만 표시합니다. 키링 추천은 다음 베타에서 제공할 예정입니다."
            title="키링 추천안이 아직 없어요"
            tone="empty"
          />
        </div>
      </AppShell>
    );
  }

  const isAnimated = category === "wallet";

  return (
    <AppShell
      contentWidth="full"
      footer={
        <StickyActionBar>
          <ButtonLink
            fullWidth
            href={
              category === "wallet"
                ? "/submissions/demo/designs/passport-wallet"
                : "/submissions/demo/designs?category=wallet"
            }
          >
            {category === "wallet"
              ? "3D 목업 미리보기"
              : "3D 목업 제공 디자인 보기"}
          </ButtonLink>
        </StickyActionBar>
      }
      header={header}
    >
      <div className={styles.recommendationViewport}>
        <ul
          aria-label={`${TABS.find((tab) => tab.id === category)?.label} 추천 목록`}
          className={[
            styles.recommendationTrack,
            isAnimated ? styles.recommendationTrackAnimated : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {/* TODO(post-beta): persist the selected recommendation and resolve a contract-backed 3D asset for each product. */}
          {items.map((item, index) => (
            <li key={item.name}>
              <Link
                className={styles.productCard}
                href="/submissions/demo/designs/passport-wallet"
              >
                <span className={styles.productImage}>
                  <Image
                    alt={`${item.name} 추천 디자인`}
                    fill
                    loading={index < 4 ? "eager" : "lazy"}
                    sizes="(max-width: 402px) 50vw, 168px"
                    src={item.image}
                  />
                </span>
                <span className={styles.productName}>{item.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
