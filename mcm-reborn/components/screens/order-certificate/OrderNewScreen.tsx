import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { Button } from "@/components/ui/Button";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { SectionBand } from "@/components/ui/SectionBand";
import { TextField } from "@/components/ui/TextField";
import { DEMO_SCENARIO, formatKrw } from "@/data/demo-scenario";
import type { DemoState } from "./demo-state";
import { DemoStatePanel } from "./DemoStatePanel";
import styles from "./order-certificate.module.css";

type OrderNewScreenProps = {
  state: Extract<
    DemoState,
    "normal" | "loading" | "empty" | "error" | "permission"
  >;
};

export function OrderNewScreen({ state }: OrderNewScreenProps) {
  const isNormal = state === "normal";
  const { order, selectedDesign } = DEMO_SCENARIO;

  return (
    <AppShell
      footer={
        isNormal ? (
          <StickyActionBar>
            <Button form="order-application-form" fullWidth type="submit">
              주문 확인 및 결제
            </Button>
          </StickyActionBar>
        ) : undefined
      }
      header={
        <PageHeader
          backHref="/submissions/demo/designs/passport-wallet"
          title="업사이클링 주문"
        />
      }
    >
      {!isNormal ? (
        <div className={styles.stateInset}>
          <DemoStatePanel
            emptyDescription="선택한 업사이클링 제품이 없습니다. 제품 추천에서 제작안을 먼저 선택해 주세요."
            retryHref="/orders/new"
            state={state}
            subject="주문 정보"
          />
        </div>
      ) : (
        <>
          <section
            aria-labelledby="selected-product"
            className={styles.summaryBlock}
          >
            <h2 className={styles.visuallyHidden} id="selected-product">
              선택 상품
            </h2>
            <KeyValueList
              items={[
                { label: "선택 상품", value: selectedDesign.name },
                {
                  label: "예상 제작 기간",
                  value: selectedDesign.initialEstimatedDuration,
                },
                {
                  label: "제작 비용",
                  value: formatKrw(selectedDesign.initialPriceKrw),
                },
              ]}
            />
          </section>
          <SectionBand />
          <section aria-label="수거 방법" className={styles.pickupMethod}>
            <KeyValueList
              items={[
                { label: "수거 방법", value: "방문 택배 수거" },
                { label: "수거 비용", value: "무료" },
              ]}
            />
          </section>
          <SectionBand />
          <form action="/checkout" id="order-application-form" method="get">
            <Section title="주문자 정보">
              <div className={styles.fieldStack}>
                <TextField
                  autoComplete="name"
                  defaultValue={order.customer.name}
                  id="customer-name"
                  label="이름"
                  name="customerName"
                  required
                />
                <TextField
                  autoComplete="tel"
                  defaultValue={order.customer.phone}
                  id="customer-phone"
                  inputMode="tel"
                  label="휴대폰 번호"
                  name="customerPhone"
                  required
                  type="tel"
                />
                <TextField
                  autoComplete="postal-code"
                  defaultValue={order.customer.postalCode}
                  id="customer-postal-code"
                  inputMode="numeric"
                  label="우편번호"
                  name="postalCode"
                  required
                />
                <TextField
                  autoComplete="street-address"
                  defaultValue={order.customer.address}
                  id="customer-address"
                  label="주소"
                  name="address"
                  required
                />
                <TextField
                  autoComplete="address-line2"
                  defaultValue={order.customer.addressDetail}
                  id="customer-address-detail"
                  label="상세 주소"
                  name="addressDetail"
                  required
                />
              </div>
            </Section>
            <SectionBand />
            <Section
              description="원하시는 방문 수거 일정을 확인해 주세요. 수거 비용은 무료입니다."
              title="수거 정보"
            >
              <div className={styles.scheduleGrid}>
                <TextField
                  defaultValue={order.pickupDate}
                  id="pickup-date"
                  label="수거 희망일"
                  name="pickupDate"
                  required
                  type="date"
                />
                <TextField
                  defaultValue={order.pickupTimeLabel}
                  id="pickup-time"
                  label="수거 시간대"
                  name="pickupTime"
                  required
                />
              </div>
              <fieldset className={styles.consentGroup}>
                <legend>필수 확인</legend>
                <label className={styles.checkRow}>
                  <input name="termsAccepted" required type="checkbox" />
                  <span>서비스 이용 약관과 개인정보 처리 내용을 확인했습니다.</span>
                </label>
                <label className={styles.checkRow}>
                  <input name="estimateAccepted" required type="checkbox" />
                  <span>
                    AI 분석 결과는 예상치이며 실물 검수 후 조정될 수 있음을
                    확인했습니다.
                  </span>
                </label>
                <label className={styles.checkRow}>
                  <input name="inspectionAccepted" required type="checkbox" />
                  <span>
                    변경된 제작 조건은 확인과 승인 후 적용됨을 확인했습니다.
                  </span>
                </label>
              </fieldset>
            </Section>
          </form>
        </>
      )}
    </AppShell>
  );
}
