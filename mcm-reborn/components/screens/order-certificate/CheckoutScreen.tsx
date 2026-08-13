import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { ButtonLink } from "@/components/ui/Button";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { SectionBand } from "@/components/ui/SectionBand";
import { DEMO_ORDER } from "./demo-data";
import type { DemoState } from "./demo-state";
import { DemoStatePanel } from "./DemoStatePanel";
import styles from "./order-certificate.module.css";

type CheckoutScreenProps = {
  state: Extract<
    DemoState,
    "normal" | "loading" | "empty" | "error" | "canceled"
  >;
};

const PAYMENT_METHODS = [
  "데모 카드",
  "네이버페이",
  "카카오페이",
  "토스페이",
  "휴대폰결제",
  "무통장입금",
] as const;

export function CheckoutScreen({ state }: CheckoutScreenProps) {
  const isNormal = state === "normal";

  return (
    <AppShell
      footer={
        isNormal ? (
          <StickyActionBar>
            {/* TODO(post-beta): 결제사 승인 및 멱등 결제 연동 */}
            <ButtonLink
              aria-describedby="mock-payment-notice"
              fullWidth
              href="/orders/demo/complete"
            >
              데모 결제 확인
            </ButtonLink>
          </StickyActionBar>
        ) : undefined
      }
      header={
        <PageHeader backHref="/orders/new" title="주문 확인 및 결제" />
      }
    >
      {!isNormal ? (
        <div className={styles.stateInset}>
          <DemoStatePanel
            canceledDescription="결제 화면을 닫았습니다. 실제 결제나 주문 상태 변경은 발생하지 않았습니다."
            emptyDescription="결제할 신청 정보가 없습니다. 배송 정보를 먼저 입력해 주세요."
            retryHref="/checkout"
            state={state}
            subject="결제 정보"
          />
        </div>
      ) : (
        <>
          <section aria-labelledby="checkout-product" className={styles.summaryBlock}>
            <h2 className={styles.visuallyHidden} id="checkout-product">
              주문 상품
            </h2>
            <KeyValueList
              items={[
                { label: "업사이클링 제품", value: DEMO_ORDER.product.name },
                {
                  label: "예상 원단 재활용률",
                  value: DEMO_ORDER.product.recycleRate,
                },
                {
                  label: "수거지",
                  value: `${DEMO_ORDER.customer.address} ${DEMO_ORDER.customer.addressDetail}`,
                },
              ]}
            />
          </section>
          <SectionBand />
          <Section title="결제 수단">
            <fieldset className={styles.paymentFieldset}>
              <legend className={styles.visuallyHidden}>결제 수단 선택</legend>
              <div className={styles.paymentGrid}>
                {PAYMENT_METHODS.map((method, index) => (
                  <label className={styles.paymentOption} key={method}>
                    <input
                      defaultChecked={index === 0}
                      name="paymentMethod"
                      type="radio"
                      value={method}
                    />
                    <span>{method}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <p className={styles.demoNotice} id="mock-payment-notice">
              데모용 Mock 결제입니다. 실제 금액 청구나 결제사 요청은 발생하지 않습니다.
              <span>TODO(post-beta): 실제 결제 연동</span>
            </p>
          </Section>
          <SectionBand />
          <Section title="결제 정보">
            <KeyValueList
              items={[
                { label: "상품 금액", value: DEMO_ORDER.product.price },
                { label: "총 배송비", value: DEMO_ORDER.deliveryFee },
                { label: "결제 수단", value: DEMO_ORDER.paymentMethod },
                {
                  emphasis: true,
                  label: "최종 결제 금액",
                  value: DEMO_ORDER.finalAmount,
                },
              ]}
            />
            <label className={styles.checkRow}>
              <input required type="checkbox" />
              <span>Mock 결제와 데모 주문임을 확인했습니다.</span>
            </label>
          </Section>
        </>
      )}
    </AppShell>
  );
}
