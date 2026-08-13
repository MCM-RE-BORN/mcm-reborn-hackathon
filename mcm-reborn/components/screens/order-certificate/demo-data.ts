export const DEMO_ORDER = {
  applicationDate: "2026.08.24",
  applicationNumber: "RB-DEMO-20260824",
  customer: {
    address: "서울시 중구 데모로 24",
    addressDetail: "RE:BORN 체험관 2층",
    name: "데모 고객",
    phone: "010-0000-0000",
  },
  deliveryFee: "5,000원",
  finalAmount: "153,000원",
  paymentMethod: "데모 카드",
  product: {
    estimatedDuration: "3~4주",
    image: "/assets/mvp-beta/product-passport-wallet.png",
    name: "Ottomar 비세토스 여권 지갑",
    price: "148,000원",
    quantity: "1개",
    recycleRate: "72%",
  },
} as const;

export const DEMO_PASSPORT = {
  artisan: "성주재단 데모 아틀리에",
  createdAt: "2026.08.24",
  id: "MCM_REBORN_DEMO_00001",
} as const;
