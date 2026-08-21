import type { ProductCode } from "@/contracts/product";

export const RECOMMENDATION_CATEGORIES = [
  { id: "travel", label: "트래블" },
  { id: "wallet", label: "지갑" },
  { id: "pouch", label: "파우치" },
  { id: "keyring", label: "키링" },
] as const;

export type RecommendationCategory =
  (typeof RECOMMENDATION_CATEGORIES)[number]["id"];

export type RecommendationProduct = {
  detailHref?: string;
  id: string;
  image: string;
  name: string;
  productCode?: ProductCode;
};

// Figma visual candidates are grouped for browsing. Only a card with
// `detailHref` is an orderable canonical demo product.
export const RECOMMENDATION_PRODUCTS: Record<
  RecommendationCategory,
  readonly RecommendationProduct[]
> = {
  travel: [
    {
      detailHref: "/submissions/demo/designs/passport-wallet",
      id: "passport-wallet",
      image: "/assets/mvp-beta/figma-travel-passport-wallet.png",
      name: "RE:BORN 여권 지갑",
      productCode: "REBORN_PASSPORT_WALLET",
    },
    {
      id: "luggage-tag",
      image: "/assets/mvp-beta/figma-travel-luggage-tag.png",
      name: "RE:BORN 러기지 택",
      productCode: "REBORN_NAME_TAG",
    },
    {
      id: "travel-case-medium",
      image: "/assets/mvp-beta/figma-travel-case-medium.png",
      name: "RE:BORN M 트래블 케이스",
    },
    {
      id: "travel-case-small",
      image: "/assets/mvp-beta/figma-travel-case-small.png",
      name: "RE:BORN S 트래블 케이스",
    },
    {
      id: "toiletry-bag",
      image: "/assets/mvp-beta/figma-travel-toiletry-bag.png",
      name: "RE:BORN S 토일레트리 백",
    },
    {
      id: "travel-mini-pouch",
      image: "/assets/mvp-beta/figma-travel-mini-pouch.png",
      name: "RE:BORN 미니 트래블 파우치",
    },
    {
      id: "hat-box",
      image: "/assets/mvp-beta/figma-travel-hat-box.png",
      name: "RE:BORN 미니 모자 박스",
    },
    {
      id: "bottle-holder",
      image: "/assets/mvp-beta/figma-travel-bottle-holder.png",
      name: "RE:BORN 인조 퍼와 Mars Dog 보틀 홀더",
    },
  ],
  wallet: [
    {
      id: "card-holder",
      image: "/assets/mvp-beta/recommendation-card-holder.png",
      name: "RE:BORN 카드 홀더",
      productCode: "REBORN_CARD_WALLET",
    },
    {
      id: "bifold-wallet",
      image: "/assets/mvp-beta/recommendation-bifold-wallet.png",
      name: "RE:BORN 바이폴드 지갑",
    },
    {
      id: "chain-wallet",
      image: "/assets/mvp-beta/recommendation-chain-wallet.png",
      name: "RE:BORN 체인 지갑",
    },
    {
      id: "zip-wallet",
      image: "/assets/mvp-beta/recommendation-zip-wallet.png",
      name: "RE:BORN 지퍼 지갑",
    },
    {
      id: "studded-wallet",
      image: "/assets/mvp-beta/recommendation-studded-wallet.png",
      name: "RE:BORN 스터드 지갑",
    },
  ],
  pouch: [
    {
      id: "card-pouch",
      image: "/assets/mvp-beta/recommendation-card-pouch.png",
      name: "RE:BORN 카드 파우치",
    },
    {
      id: "crossbody-wallet",
      image: "/assets/mvp-beta/recommendation-crossbody-wallet.png",
      name: "RE:BORN 크로스바디 파우치",
    },
    {
      id: "travel-mini-pouch",
      image: "/assets/mvp-beta/figma-travel-mini-pouch.png",
      name: "RE:BORN 미니 파우치",
    },
    {
      id: "travel-toiletry-pouch",
      image: "/assets/mvp-beta/figma-travel-toiletry-bag.png",
      name: "RE:BORN 토일레트리 파우치",
    },
  ],
  keyring: [
    {
      id: "keyring",
      image: "/assets/mvp-beta/recommendation-keyring-v2.webp",
      name: "RE:BORN 키링",
      productCode: "REBORN_KEYRING",
    },
    {
      id: "tag-keyring",
      image: "/assets/mvp-beta/recommendation-luggage-name-tag-v2.webp",
      name: "RE:BORN 태그 키링",
    },
    {
      id: "chain-keyring",
      image: "/assets/mvp-beta/recommendation-chain-wallet.png",
      name: "RE:BORN 체인 키링",
    },
  ],
};

export function readRecommendationCategory(
  value: string | string[] | undefined,
): RecommendationCategory {
  const normalized = Array.isArray(value) ? value[0] : value;

  return RECOMMENDATION_CATEGORIES.some((item) => item.id === normalized)
    ? (normalized as RecommendationCategory)
    : "travel";
}
