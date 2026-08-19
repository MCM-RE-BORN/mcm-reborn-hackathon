"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { Button } from "@/components/ui/Button";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { SectionBand } from "@/components/ui/SectionBand";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { formatKrw } from "@/lib/formatters";
import type { DemoState } from "./demo-state";
import { DemoStatePanel } from "./DemoStatePanel";
import {
  customerFetch,
  type CustomerAnalysis,
  type CustomerApplicationSummary,
  type CustomerProductDetail,
} from "./customer-client";
import {
  formatPickupDateLabel,
  formatPickupTimeLabel,
  useOrderDraft,
} from "./OrderDraftProvider";
import styles from "./order-certificate.module.css";

type CheckoutScreenProps = {
  analysisId?: string;
  productId?: string;
  state: Extract<
    DemoState,
    "normal" | "loading" | "empty" | "error" | "permission" | "canceled"
  >;
};

export function CheckoutScreen({ analysisId, productId, state }: CheckoutScreenProps) {
  const router = useRouter();
  const { orderDraft } = useOrderDraft();
  const isNormal = state === "normal";
  const [product, setProduct] = useState<CustomerProductDetail | null>(null);
  const [analysis, setAnalysis] = useState<CustomerAnalysis | null>(null);
  const [requestError, setRequestError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isNormal || !analysisId || !productId) {
      return;
    }
    let cancelled = false;
    Promise.all([
      customerFetch<CustomerProductDetail>(
        `/api/v2/products/${productId}?analysisId=${encodeURIComponent(analysisId)}`,
      ),
      customerFetch<CustomerAnalysis>(`/api/v2/analyses/${analysisId}`),
    ])
      .then(([productResponse, analysisResponse]) => {
        if (!cancelled) {
          setProduct(productResponse);
          setAnalysis(analysisResponse);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRequestError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [analysisId, isNormal, productId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!analysisId || !productId || !product || isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setRequestError(false);
    try {
      const created = await customerFetch<CustomerApplicationSummary>(
        "/api/v2/applications",
        {
          body: JSON.stringify({
            analysisId,
            consents: {
              aiEstimateNoticeAccepted: true,
              inspectionChangeNoticeAccepted: true,
              serviceAndPrivacyTermsAccepted: true,
            },
            pickupSchedule: {
              requestedDate: orderDraft.pickupDate,
              timeWindow: orderDraft.pickupTime,
            },
            productId,
            selectedOptions: defaultOptions(product.optionGroups),
            shippingAddress: {
              address1: orderDraft.address,
              address2: orderDraft.addressDetail,
              phone: orderDraft.phone,
              postalCode: orderDraft.postalCode,
              recipientName: orderDraft.name,
            },
          }),
          method: "POST",
        },
      );
      await customerFetch(`/api/v2/applications/${created.id}/mock-payment`, {
        body: JSON.stringify({ method: "DEMO_CARD", simulate: "SUCCESS" }),
        method: "POST",
      });
      router.replace(`/orders/demo/complete?applicationId=${created.id}`);
    } catch {
      setRequestError(true);
      setIsSubmitting(false);
    }
  }

  return (
    <AppShell
      footer={
        isNormal && product ? (
          <StickyActionBar>
            <Button
              aria-describedby="payment-environment-notice"
              disabled={isSubmitting}
              form="checkout-form"
              fullWidth
              type="submit"
            >
              {isSubmitting ? "신청 처리 중..." : `${formatKrw(product.mockPrice.amount)} 결제하기`}
            </Button>
          </StickyActionBar>
        ) : undefined
      }
      header={<PageHeader backHref="/orders/new" title="주문 확인 및 결제" />}
    >
      {!isNormal ? (
        <div className={styles.stateInset}>
          <DemoStatePanel
            canceledDescription="결제를 취소했습니다. 신청은 생성되지 않았습니다."
            emptyDescription="결제할 신청 정보가 없습니다. 주문자 정보와 수거 일정을 먼저 입력해 주세요."
            retryHref="/orders/new"
            state={state}
            subject="결제 정보"
          />
        </div>
      ) : requestError || !analysisId || !productId ? (
        <div className={styles.stateInset}>
          <DemoStatePanel
            emptyDescription="신청에 필요한 분석과 제품 정보를 불러오지 못했습니다."
            retryHref="/orders/new"
            state="error"
            subject="결제 정보"
          />
        </div>
      ) : !product || !analysis ? (
        <div className={styles.stateInset}>
          <StatusPanel
            description="Supabase에서 신청 조건과 분석 결과를 확인하고 있습니다."
            title="결제 정보를 준비하고 있어요"
            tone="loading"
          />
        </div>
      ) : (
        <>
          <section aria-labelledby="checkout-product" className={styles.summaryBlock}>
            <h2 className={styles.visuallyHidden} id="checkout-product">주문 상품</h2>
            <KeyValueList
              items={[
                { label: "업사이클링 제품", value: product.name },
                { label: "AI 예상 재사용률", value: `${analysis.estimatedReusableMaterialRate}%` },
                { label: "주문자", value: orderDraft.name || "-" },
                { label: "연락처", value: orderDraft.phone || "-" },
                { label: "수거지", value: `(${orderDraft.postalCode}) ${orderDraft.address} ${orderDraft.addressDetail}` },
                { label: "수거 일정", value: `${formatPickupDateLabel(orderDraft.pickupDate)} ${formatPickupTimeLabel(orderDraft.pickupTime)}` },
              ]}
            />
          </section>
          <SectionBand />
          <form id="checkout-form" method="post" onSubmit={handleSubmit}>
            <Section title="결제 수단">
              <fieldset className={styles.paymentFieldset}>
                <legend className={styles.visuallyHidden}>결제 수단 선택</legend>
                <label className={styles.paymentOption}>
                  <input defaultChecked name="paymentMethod" required type="radio" value="card" />
                  <span>신용·체크카드</span>
                </label>
              </fieldset>
              <p className={styles.environmentNotice} id="payment-environment-notice">
                시연 환경에서는 실제 결제가 이루어지지 않습니다.
              </p>
            </Section>
            <SectionBand />
            <Section title="결제 정보">
              <KeyValueList
                items={[
                  { label: "제작 금액", value: formatKrw(product.mockPrice.amount) },
                  { label: "수거 비용", value: "무료" },
                  { label: "결제 수단", value: "신용·체크카드" },
                  { emphasis: true, label: "총 결제 금액", value: formatKrw(product.mockPrice.amount) },
                ]}
              />
              <label className={styles.checkRow}>
                <input name="orderConfirmed" required type="checkbox" />
                <span>주문 내용과 실물 검수 후 제작 조건이 조정될 수 있음을 확인했습니다.</span>
              </label>
            </Section>
          </form>
        </>
      )}
    </AppShell>
  );
}

function defaultOptions(optionGroups: CustomerProductDetail["optionGroups"]) {
  return Object.fromEntries(
    optionGroups
      .filter((group) => group.required)
      .map((group) => [
        group.key,
        group.type === "SELECT" ? group.options?.[0]?.value ?? "" : "",
      ]),
  );
}
