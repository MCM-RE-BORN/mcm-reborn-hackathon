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
  state: Extract<DemoState, "normal" | "loading" | "empty" | "error">;
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
      header={<PageHeader backHref="/" title="업사이클링 신청" />}
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
          <form action="/checkout" id="order-application-form" method="get">
            <Section title="주문자 정보">
              <div className={styles.fieldStack}>
                <TextField
                  autoComplete="name"
                  defaultValue={DEMO_ORDER.customer.name}
                  id="customer-name"
                  label="이름"
                  name="name"
                  required
                />
                <TextField
                  autoComplete="tel"
                  defaultValue={DEMO_ORDER.customer.phone}
                  id="customer-phone"
                  inputMode="tel"
                  label="휴대폰 번호"
                  name="phone"
                  required
                  type="tel"
                />
                <div className={styles.addressRow}>
                  <TextField
                    autoComplete="street-address"
                    defaultValue={DEMO_ORDER.customer.address}
                    id="customer-address"
                    label="주소"
                    name="address"
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
                  autoComplete="address-line2"
                  defaultValue={DEMO_ORDER.customer.addressDetail}
                  id="customer-address-detail"
                  label="상세 주소"
                  name="addressDetail"
                  required
                />
                <p className={styles.postBetaNote} id="address-post-beta">
                  TODO(post-beta): 주소 검색 연동 전까지 데모 주소를 직접 입력합니다.
                </p>
              </div>
            </Section>
            <SectionBand />
            <Section
              description="현재 베타는 계약에 정의된 택배 수거만 사용합니다."
              title="수거 정보"
            >
              <div className={styles.scheduleGrid}>
                <TextField
                  disabled
                  hint="TODO(post-beta): 수거 일정 선택"
                  id="pickup-date"
                  label="수거 희망일 (베타 미지원)"
                  name="pickupDate"
                  placeholder="추후 제공"
                />
                <TextField
                  disabled
                  hint="TODO(post-beta): 시간대 선택"
                  id="pickup-time"
                  label="수거 시간대 (베타 미지원)"
                  name="pickupTime"
                  placeholder="추후 제공"
                />
              </div>
              <fieldset className={styles.consentGroup}>
                <legend>필수 확인</legend>
                <label className={styles.checkRow}>
                  <input name="pickupAgreement" required type="checkbox" />
                  <span>택배 수거와 데모 제작 안내를 확인했습니다.</span>
                </label>
                <label className={styles.checkRow}>
                  <input name="privacyAgreement" required type="checkbox" />
                  <span>데모 신청을 위한 정보 이용에 동의합니다.</span>
                </label>
              </fieldset>
            </Section>
          </form>
        </>
      )}
    </AppShell>
  );
}
