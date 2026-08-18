import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageHeader } from "@/components/layout/PageHeader";
import { DEMO_SCENARIO, formatKrw } from "@/data/demo-scenario";
import type { DemoState, OrderStage } from "./demo-state";
import { DemoStatePanel } from "./DemoStatePanel";
import styles from "./order-certificate.module.css";

type OrdersListScreenProps = {
  stage: OrderStage;
  state: Extract<
    DemoState,
    "normal" | "loading" | "empty" | "error" | "permission"
  >;
};

const STAGE_LABELS: Record<OrderStage, string> = {
  pickup: "접수 완료",
  inspection: "실물 검수 중",
  "change-required": "변경 조건 확인 필요",
  production: "제작 중",
  quality: "품질 확인 중",
  shipping: "배송 중",
  completed: "완료",
  canceled: "신청 취소",
};

const FINAL_TERM_STAGES: OrderStage[] = [
  "production",
  "quality",
  "shipping",
  "completed",
];

export function OrdersListScreen({ stage, state }: OrdersListScreenProps) {
  const { expertInspection, order, selectedDesign } = DEMO_SCENARIO;
  const displayedPrice = FINAL_TERM_STAGES.includes(stage)
    ? expertInspection.revisedPriceKrw
    : selectedDesign.initialPriceKrw;

  return (
    <AppShell
      footer={<BottomNav active="orders" />}
      header={<PageHeader title="신청 내역" />}
    >
      {state !== "normal" ? (
        <div className={styles.stateInset}>
          <DemoStatePanel
            emptyDescription="아직 접수된 업사이클링 신청이 없습니다."
            retryHref="/orders"
            state={state}
            subject="신청 내역"
          />
        </div>
      ) : (
        <section
          aria-labelledby="orders-list-heading"
          className={styles.ordersListLayout}
        >
          <header className={styles.ordersListHeader}>
            <h2 id="orders-list-heading">신청 상품</h2>
            <span>1건</span>
          </header>

          <ul className={styles.ordersList}>
            <li>
              <Link
                aria-label={`${selectedDesign.name} 신청 상세 보기`}
                className={styles.ordersListCard}
                href={`/orders/demo?stage=${stage}`}
              >
                <div className={styles.ordersListCardMeta}>
                  <span>{STAGE_LABELS[stage]}</span>
                  <small>{order.number}</small>
                </div>

                <div className={styles.ordersListProductRow}>
                  <span className={styles.ordersListThumbnail}>
                    <Image
                      alt={`${selectedDesign.name} 제품 이미지`}
                      fill
                      sizes="52px"
                      src="/assets/mvp-beta/figma-order-product.png"
                    />
                  </span>
                  <span className={styles.ordersListProductCopy}>
                    <strong>{selectedDesign.name}</strong>
                    <span>신청일 {order.orderedAt}</span>
                    <span>수량: 1개</span>
                  </span>
                  <strong className={styles.ordersListPrice}>
                    {formatKrw(displayedPrice)}
                  </strong>
                </div>

                <span className={styles.ordersListCardAction}>
                  신청 상세 보기
                  <Image
                    alt=""
                    aria-hidden="true"
                    height={10}
                    src="/assets/mvp-beta/icon-chevron-right.svg"
                    width={12}
                  />
                </span>
              </Link>
            </li>
          </ul>
        </section>
      )}
    </AppShell>
  );
}
