"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { formatKrw } from "@/lib/formatters";
import type { DemoState } from "./demo-state";
import { DemoStatePanel } from "./DemoStatePanel";
import {
  applicationStatusToOrderStage,
  customerFetch,
  formatApiDate,
  readImageUrl,
  type CustomerApplicationPage,
  type CustomerApplicationSummary,
} from "./customer-client";
import styles from "./order-certificate.module.css";

type OrdersListScreenProps = {
  state: Extract<
    DemoState,
    "normal" | "loading" | "empty" | "error" | "permission"
  >;
};

export function OrdersListScreen({ state }: OrdersListScreenProps) {
  const [applications, setApplications] = useState<
    CustomerApplicationSummary[] | null
  >(null);
  const [requestError, setRequestError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    customerFetch<CustomerApplicationPage>("/api/v2/applications?size=50")
      .then((response) => {
        if (!cancelled) {
          setApplications(response.items);
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
  }, []);

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
      ) : requestError ? (
        <div className={styles.stateInset}>
          <DemoStatePanel
            emptyDescription="신청 내역을 불러오지 못했습니다."
            retryHref="/orders"
            state="error"
            subject="신청 내역"
          />
        </div>
      ) : applications === null ? (
        <div className={styles.stateInset}>
          <StatusPanel
            description="Supabase에서 고객님의 신청 내역을 불러오고 있습니다."
            title="신청 내역을 확인하고 있어요"
            tone="permission"
          />
        </div>
      ) : (
        <section
          aria-labelledby="orders-list-heading"
          className={styles.ordersListLayout}
        >
          <header className={styles.ordersListHeader}>
            <h2 id="orders-list-heading">신청 상품</h2>
            <span>{applications.length}건</span>
          </header>

          {applications.length === 0 ? (
            <div className={styles.stateInset}>
              <DemoStatePanel
                emptyDescription="아직 접수된 업사이클링 신청이 없습니다."
                retryHref="/products/new"
                state="empty"
                subject="신청 내역"
              />
            </div>
          ) : (
            <ul className={styles.ordersList}>
              {applications.map((application) => (
                <ApplicationListItem
                  application={application}
                  key={application.id}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </AppShell>
  );
}

function ApplicationListItem({
  application,
}: {
  application: CustomerApplicationSummary;
}) {
  const stage = applicationStatusToOrderStage(application.status);
  const image = readImageUrl(application.product.listImage);
  return (
    <li>
      <Link
        aria-label={`${application.product.name} 신청 상세 보기`}
        className={styles.ordersListCard}
        href={`/orders/demo?applicationId=${encodeURIComponent(application.id)}`}
      >
        <div className={styles.ordersListCardMeta}>
          <span>{stageLabel(stage)}</span>
          <small>{application.applicationNumber}</small>
        </div>

        <div className={styles.ordersListProductRow}>
          <span className={styles.ordersListThumbnail}>
            <Image
              alt={`${application.product.name} 제품 이미지`}
              fill
              sizes="52px"
              src={image}
            />
          </span>
          <span className={styles.ordersListProductCopy}>
            <strong>{application.product.name}</strong>
            <span>신청일 {formatApiDate(application.createdAt)}</span>
            <span>수량: 1개</span>
          </span>
          <strong className={styles.ordersListPrice}>
            {formatKrw(application.amount.amount)}
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
  );
}

function stageLabel(stage: ReturnType<typeof applicationStatusToOrderStage>) {
  return {
    canceled: "신청 취소",
    completed: "완료",
    "change-required": "변경 조건 확인 필요",
    inspection: "실물 검수 중",
    pickup: "접수 완료",
    production: "제작 중",
    quality: "품질 확인 중",
    shipping: "배송 중",
  }[stage];
}
