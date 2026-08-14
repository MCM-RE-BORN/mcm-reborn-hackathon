import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { Button } from "@/components/ui/Button";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { SectionBand } from "@/components/ui/SectionBand";
import { TextField } from "@/components/ui/TextField";
import { DEMO_ORDER } from "./demo-data";
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

  return (
    <AppShell
      footer={
        isNormal ? (
          <StickyActionBar>
            <Button
              form="order-application-form"
              fullWidth
              type="submit"
            >
              주문 확인 및 결제
            </Button>
          </StickyActionBar>
        ) : undefined
      }
      header={
        <PageHeader
          backHref="/submissions/demo/designs/passport-wallet"
          title="업사이클링 신청"
        />
      }
    >
      {!isNormal ? (
        <div className={styles.stateInset}>
          <DemoStatePanel
            emptyDescription="선택한 업사이클링 제품이 없습니다. 제품 추천에서 제작안을 먼저 선택해 주세요."
            retryHref="/orders/new"
            state={state}
            subject="신청 정보"
          />
        </div>
      ) : (
        <>
          <section aria-labelledby="selected-product" className={styles.summaryBlock}>
            <h2 className={styles.visuallyHidden} id="selected-product">
              선택 상품
            </h2>
            <KeyValueList
              items={[
                { label: "선택 상품", value: DEMO_ORDER.product.name },
                {
                  label: "예상 제작 기간",
                  value: DEMO_ORDER.product.estimatedDuration,
                },
                { label: "제작 비용", value: DEMO_ORDER.product.price },
              ]}
            />
          </section>
          <SectionBand />
          <section aria-label="수거 방법" className={styles.pickupMethod}>
            <KeyValueList
              items={[{ label: "수거 방법", value: "택배 수거" }]}
            />
          </section>
          <SectionBand />
          {/* TODO(post-beta): persist the approved application and create the pickup request through the contract API. */}
          <form action="/checkout" id="order-application-form" method="get">
            <Section title="주문자 정보">
              <div className={styles.fieldStack}>
                <TextField
                  autoComplete="name"
                  defaultValue={DEMO_ORDER.customer.name}
                  id="customer-name"
                  label="이름"
                  required
                />
                <TextField
                  autoComplete="tel"
                  defaultValue={DEMO_ORDER.customer.phone}
                  id="customer-phone"
                  inputMode="tel"
                  label="휴대폰 번호"
                  required
                  type="tel"
                />
                <div className={styles.addressRow}>
                  <TextField
                    autoComplete="postal-code"
                    defaultValue={DEMO_ORDER.customer.postalCode}
                    id="customer-postal-code"
                    inputMode="numeric"
                    label="우편번호"
                    required
                  />
                  {/* TODO(post-beta): 주소 검색 서비스 연동 */}
                  <Button
                    aria-describedby="address-post-beta"
                    disabled
                    size="medium"
                    variant="outline"
                  >
                    주소 찾기
                  </Button>
                </div>
                <TextField
                  autoComplete="street-address"
                  defaultValue={DEMO_ORDER.customer.address}
                  id="customer-address"
                  label="주소"
                  required
                />
                <TextField
                  autoComplete="address-line2"
                  defaultValue={DEMO_ORDER.customer.addressDetail}
                  id="customer-address-detail"
                  label="상세 주소"
                  required
                />
                <p className={styles.postBetaNote} id="address-post-beta">
                  베타에서는 주소 검색 없이 데모 주소를 직접 확인합니다.
                </p>
              </div>
            </Section>
            <SectionBand />
            <Section
              description="현재 베타 데모에서는 택배 수거만 표시합니다."
              title="수거 정보"
            >
              <div className={styles.scheduleGrid}>
                <TextField
                  disabled
                  hint="수거 일정 선택은 정식 연동 후 제공됩니다."
                  id="pickup-date"
                  label="수거 희망일 (베타 미지원)"
                  placeholder="추후 제공"
                />
                <TextField
                  disabled
                  hint="시간대 선택은 정식 연동 후 제공됩니다."
                  id="pickup-time"
                  label="수거 시간대 (베타 미지원)"
                  placeholder="추후 제공"
                />
              </div>
              <fieldset className={styles.consentGroup}>
                <legend>필수 확인</legend>
                <label className={styles.checkRow}>
                  <input required type="checkbox" />
                  <span>데모 이용 약관을 확인했습니다. (demoTermsAccepted)</span>
                </label>
                <label className={styles.checkRow}>
                  <input required type="checkbox" />
                  <span>AI 분석이 예상치임을 확인했습니다. (aiEstimateNoticeAccepted)</span>
                </label>
                <label className={styles.checkRow}>
                  <input required type="checkbox" />
                  <span>ESG 수치가 데모 추정치임을 확인했습니다. (esgEstimateNoticeAccepted)</span>
                </label>
              </fieldset>
            </Section>
          </form>
        </>
      )}
    </AppShell>
  );
}
