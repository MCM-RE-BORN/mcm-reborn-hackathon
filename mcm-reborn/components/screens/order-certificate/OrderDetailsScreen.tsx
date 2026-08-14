import Image from "next/image";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { Button, ButtonLink } from "@/components/ui/Button";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { ProgressStepper } from "@/components/ui/ProgressStepper";
import { SectionBand } from "@/components/ui/SectionBand";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { DEMO_ORDER } from "./demo-data";
import type { DemoState } from "./demo-state";
import { DemoStatePanel } from "./DemoStatePanel";
import styles from "./order-certificate.module.css";

type OrderDetailsScreenProps = {
  state: DemoState;
};

const PROGRESS_STEPS = [
  "접수",
  "검수",
  "제작중",
  "품질확인",
  "배송",
  "완료",
];

export function OrderDetailsScreen({ state }: OrderDetailsScreenProps) {
  const showDetails = state === "normal" || state === "change-request";

  return (
    <AppShell
      footer={<BottomNav active="orders" />}
      header={<PageHeader backHref="/" title="신청 내역" />}
    >
      {!showDetails ? (
        <div className={styles.stateInset}>
          <DemoStatePanel
            canceledDescription="이 데모 신청은 취소되어 제작·배송 타임라인이 더 진행되지 않습니다."
            emptyDescription="아직 신청한 업사이클링 제품이 없습니다."
            retryHref="/orders/demo"
            state={state}
            subject="신청 내역"
          />
        </div>
      ) : (
        <>
          {state === "change-request" ? (
            <div className={styles.stateInset}>
              <StatusPanel
                action={
                  <Button disabled fullWidth>
                    변경 조건 확인 준비 중
                  </Button>
                }
                description="실물 검수 후 조건 변경과 고객 재승인은 Phase 2 범위입니다. 현재 베타에서는 변경을 승인하거나 제작을 재개하지 않습니다."
                title="제작 조건 확인이 필요합니다"
                tone="permission"
              />
              <KeyValueList
                dividers
                items={[
                  {
                    label: "변경 사유",
                    value: "실물 검수에서 가장자리 손상 추가 확인",
                  },
                  {
                    label: "새 제작 조건",
                    value: "제작 기간 4~5주 · 데모 견적 158,000원",
                  },
                  { label: "고객 응답", value: "베타 미지원" },
                ]}
              />
              <p className={styles.postBetaNote}>
                조건 승인·거절은 정식 계약과 상태 API가 확정된 뒤 제공됩니다.
              </p>
            </div>
          ) : null}

          <article aria-labelledby="order-product-name" className={styles.orderSummary}>
            <div className={styles.orderProductRow}>
              <div className={styles.productThumbnail}>
                <Image
                  alt={`${DEMO_ORDER.product.name} 데모 이미지`}
                  fill
                  sizes="40px"
                  src={DEMO_ORDER.product.image}
                />
              </div>
              <div className={styles.orderProductCopy}>
                <h2 id="order-product-name">{DEMO_ORDER.product.name}</h2>
                <p>신청일 {DEMO_ORDER.applicationDate}</p>
                <span>신청번호: {DEMO_ORDER.applicationNumber}</span>
                <span>수량: {DEMO_ORDER.product.quantity}</span>
              </div>
              <strong>{DEMO_ORDER.product.price}</strong>
            </div>
            <div className={styles.orderActionGrid}>
              {/* TODO(post-beta): 고객 문의 채널 연동 */}
              <Button disabled size="small" variant="secondary">
                문의하기
              </Button>
              {/* TODO(post-beta): 택배사 배송 조회 연동 */}
              <Button disabled size="small" variant="secondary">
                배송현황
              </Button>
            </div>
            <p className={styles.postBetaNote}>
              문의·배송 조회는 현재 UI 미리보기만 제공합니다.
            </p>
          </article>

          <SectionBand />
          <details className={styles.customerDetails}>
            <summary>주문자</summary>
            <KeyValueList
              items={[
                { label: "이름", value: DEMO_ORDER.customer.name },
                { label: "휴대폰", value: DEMO_ORDER.customer.phone },
              ]}
            />
          </details>
          <SectionBand />

          <Section title="배송 정보">
            <ProgressStepper currentIndex={5} items={PROGRESS_STEPS} />
            <div className={styles.divider} />
            <KeyValueList
              items={[
                { label: "수령인", value: DEMO_ORDER.customer.name },
                { label: "휴대폰", value: DEMO_ORDER.customer.phone },
                {
                  label: "주소지",
                  value: `${DEMO_ORDER.customer.address} ${DEMO_ORDER.customer.addressDetail}`,
                },
                { label: "현재 상태", value: "COMPLETED" },
              ]}
            />
            <p className={styles.demoNotice}>
              Passport 흐름 검증을 위한 별도의 완료 상태 Mock 타임라인입니다.
              실제 수거·배송 상태가 아닙니다.
            </p>
            {state === "normal" ? (
              <ButtonLink
                fullWidth
                href="/orders/demo?panel=change-request"
                variant="outline"
              >
                실물 검수 조건 변경 예시
              </ButtonLink>
            ) : null}
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
            <ButtonLink fullWidth href="/certificates/demo" variant="outline">
              디지털 ESG Passport 보기
            </ButtonLink>
          </Section>
        </>
      )}
    </AppShell>
  );
}
