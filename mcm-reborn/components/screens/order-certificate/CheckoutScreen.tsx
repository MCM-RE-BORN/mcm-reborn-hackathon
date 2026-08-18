"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { Button } from "@/components/ui/Button";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { SectionBand } from "@/components/ui/SectionBand";
import { DEMO_SCENARIO, formatKrw } from "@/data/demo-scenario";
import type { DemoState } from "./demo-state";
import { DemoStatePanel } from "./DemoStatePanel";
import {
  formatPickupDateLabel,
  formatPickupTimeLabel,
  useOrderDraft,
} from "./OrderDraftProvider";
import styles from "./order-certificate.module.css";

type CheckoutScreenProps = {
  state: Extract<
    DemoState,
    | "normal"
    | "loading"
    | "empty"
    | "error"
    | "permission"
    | "canceled"
  >;
};

export function CheckoutScreen({ state }: CheckoutScreenProps) {
  const router = useRouter();
  const { orderDraft } = useOrderDraft();
  const isNormal = state === "normal";
  const { analysis, order, selectedDesign } = DEMO_SCENARIO;
  const initialPrice = formatKrw(selectedDesign.initialPriceKrw);
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    router.push("/orders/demo/complete");
  };

  return (
    <AppShell
      footer={
        isNormal ? (
          <StickyActionBar>
            <Button
              aria-describedby="payment-environment-notice"
              form="checkout-form"
              fullWidth
              type="submit"
            >
              {initialPrice} 결제하기
            </Button>
          </StickyActionBar>
        ) : undefined
      }
      header={<PageHeader backHref="/orders/new" title="주문 확인 및 결제" />}
    >
      {!isNormal ? (
        <div className={styles.stateInset}>
          <DemoStatePanel
            canceledDescription="결제를 취소했습니다. 주문은 접수되지 않았습니다."
            emptyDescription="결제할 주문 정보가 없습니다. 주문자 정보와 수거 일정을 먼저 입력해 주세요."
            retryHref="/checkout"
            state={state}
            subject="결제 정보"
          />
        </div>
      ) : (
        <>
          <section
            aria-labelledby="checkout-product"
            className={styles.summaryBlock}
          >
            <h2 className={styles.visuallyHidden} id="checkout-product">
              주문 상품
            </h2>
            <KeyValueList
              items={[
                { label: "업사이클링 제품", value: selectedDesign.name },
                {
                  label: "AI 예상 재사용률",
                  value: `${analysis.expectedReusableMaterialRate}%`,
                },
                {
                  label: "주문자",
                  value: orderDraft.name,
                },
                {
                  label: "연락처",
                  value: orderDraft.phone,
                },
                {
                  label: "수거지",
                  value: `(${orderDraft.postalCode}) ${orderDraft.address} ${orderDraft.addressDetail}`,
                },
                {
                  label: "수거 일정",
                  value: `${formatPickupDateLabel(orderDraft.pickupDate)} ${formatPickupTimeLabel(orderDraft.pickupTime)}`,
                },
              ]}
            />
          </section>
          <SectionBand />
          <form id="checkout-form" method="post" onSubmit={handleSubmit}>
            <Section title="결제 수단">
              <fieldset className={styles.paymentFieldset}>
                <legend className={styles.visuallyHidden}>결제 수단 선택</legend>
                <label className={styles.paymentOption}>
                  <input
                    defaultChecked
                    name="paymentMethod"
                    required
                    type="radio"
                    value="card"
                  />
                  <span>신용·체크카드</span>
                </label>
              </fieldset>
              <p
                className={styles.environmentNotice}
                id="payment-environment-notice"
              >
                시연 환경에서는 실제 결제가 이루어지지 않습니다.
              </p>
            </Section>
            <SectionBand />
            <Section title="결제 정보">
              <KeyValueList
                items={[
                  { label: "제작 금액", value: initialPrice },
                  { label: "수거 비용", value: "무료" },
                  { label: "결제 수단", value: order.paymentMethodLabel },
                  {
                    emphasis: true,
                    label: "총 결제 금액",
                    value: initialPrice,
                  },
                ]}
              />
              <label className={styles.checkRow}>
                <input name="orderConfirmed" required type="checkbox" />
                <span>
                  주문 내용과 실물 검수 후 제작 조건이 조정될 수 있음을
                  확인했습니다.
                </span>
              </label>
            </Section>
          </form>
        </>
      )}
    </AppShell>
  );
}
