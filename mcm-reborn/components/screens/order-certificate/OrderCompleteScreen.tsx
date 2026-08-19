"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import type { DemoState } from "./demo-state";
import { DemoStatePanel } from "./DemoStatePanel";
import {
  formatPickupDateLabel,
  formatPickupTimeLabel,
} from "./OrderDraftProvider";
import {
  customerFetch,
  readJsonString,
  type CustomerApplicationDetail,
} from "./customer-client";
import styles from "./order-certificate.module.css";

type OrderCompleteScreenProps = {
  applicationId?: string;
  state: Extract<
    DemoState,
    "normal" | "loading" | "empty" | "error" | "permission"
  >;
};

export function OrderCompleteScreen({ applicationId, state }: OrderCompleteScreenProps) {
  const [application, setApplication] = useState<CustomerApplicationDetail | null>(null);
  const [requestError, setRequestError] = useState(false);

  useEffect(() => {
    if (state !== "normal" || !applicationId) {
      return;
    }
    let cancelled = false;
    customerFetch<CustomerApplicationDetail>(`/api/v2/applications/${applicationId}`)
      .then((value) => {
        if (!cancelled) {
          setApplication(value);
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
  }, [applicationId, state]);

  const pickupDate = readJsonString(application?.pickupSchedule, "requestedDate");
  const pickupTime = readJsonString(application?.pickupSchedule, "timeWindow");

  return (
    <AppShell
      header={state === "normal" ? undefined : <PageHeader backHref="/checkout" />}
    >
      {state !== "normal" ? (
        <div className={styles.stateInset}>
          <h1 className={styles.visuallyHidden}>주문 접수 완료</h1>
          <DemoStatePanel
            emptyDescription="접수된 주문을 찾지 못했습니다. 신청 내역에서 주문 상태를 다시 확인해 주세요."
            retryHref="/orders/demo/complete"
            state={state}
            subject="주문 접수 정보"
          />
        </div>
      ) : requestError || !applicationId ? (
        <div className={styles.stateInset}>
          <DemoStatePanel
            emptyDescription="신청 완료 정보를 찾지 못했습니다. 신청 내역에서 주문 상태를 다시 확인해 주세요."
            retryHref="/orders"
            state="error"
            subject="주문 접수 정보"
          />
        </div>
      ) : !application ? (
        <div className={styles.stateInset}>
          <DemoStatePanel
            emptyDescription="신청 완료 정보를 준비하고 있습니다."
            retryHref="/orders"
            state="loading"
            subject="주문 접수 정보"
          />
        </div>
      ) : (
        <section className={styles.completeLayout}>
          <Image
            alt=""
            aria-hidden="true"
            className={styles.completeIcon}
            height={126}
            priority
            src="/assets/mvp-beta/icon-complete-check.svg"
            width={126}
          />
          <div className={styles.completeCopy}>
            <h1>주문이 접수되었습니다</h1>
            <p>
              주문번호 <u>{application.applicationNumber}</u>
            </p>
            <p>
              {formatPickupDateLabel(pickupDate)} {formatPickupTimeLabel(pickupTime)} 수거 예정
            </p>
          </div>
          <ButtonLink fullWidth href={`/orders/demo?applicationId=${application.id}`}>
            주문 진행 확인하기
          </ButtonLink>
          <p className={styles.demoCaption}>
            수거 후 전문가의 실물 검수를 거쳐 최종 제작 조건이 확정됩니다.
          </p>
        </section>
      )}
    </AppShell>
  );
}
