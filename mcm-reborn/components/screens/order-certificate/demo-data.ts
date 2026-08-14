export const DEMO_ORDER = {
  applicationDate: "2026.08.14",
  // Presentation-only identifier: intentionally distinct from mock-data.json records.
  applicationNumber: "RB-20260814-9001",
  customer: {
    address: "서울시 중구 데모로 24",
    addressDetail: "RE:BORN 체험관 2층",
    name: "데모 고객",
    phone: "010-0000-0000",
    postalCode: "04524",
  },
  deliveryFee: "5,000원",
  finalAmount: "153,000원",
  paymentMethod: "DEMO_CARD",
  product: {
    estimatedDuration: "3~4주",
    image: "/assets/mvp-beta/product-passport-wallet.png",
    name: "Ottomar 비세토스 여권 지갑",
    price: "148,000원",
    quantity: "1개",
    recycleRate: "72%",
  },
} as const;

export const DEMO_PENDING_APPLICATION = {
  applicationNumber: "RB-20260814-0001",
  applicationStatus: "PENDING_APPROVAL",
} as const;

export const DEMO_PASSPORT = {
  // Presentation-only identifiers: do not resolve against the public mock fixture.
  certificateId: "4f000000-0000-4000-8000-000000009001",
  certificateNumber: "ESG-RB-20260814-9001",
  artisan: "성주재단 데모 아틀리에",
  estimatedCarbonSavingKgCo2e: 4.13,
  issuedAt: "2026.08.14 14:20",
  methodologyVersion: "DEMO_LCA_V1",
  reusedAreaCm2: 3444,
  sourceCategory: "BACKPACK",
  verificationCode: "DEMO-PRES-9001",
  disclaimer: "해커톤용 가상 보증서이며 법적·상업적 효력이 없습니다.",
} as const;
