"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import {
  hasConfirmedInspection,
  OPERATION_STAGE_PRESENTATION,
  operationDetailHref,
  readOperationStatus,
} from "./operations-data";
import {
  operatorFetch,
  type OperatorApplicationSummary,
  type OperatorApplicationPage,
} from "./operator-client";
import { OperationsShell } from "./OperationsShell";
import { OperatorLoginPanel } from "./OperatorLoginPanel";
import styles from "./operations.module.css";

type OperationsListScreenProps = {
  empty: boolean;
};

export function OperationsListScreen({
  empty,
}: OperationsListScreenProps) {
  const [liveApplications, setLiveApplications] = useState<
    OperatorApplicationSummary[] | null
  >(null);
  const [connectionError, setConnectionError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    operatorFetch<OperatorApplicationPage>(
      "/api/v2/admin/applications?size=50",
    )
      .then((response) => {
        if (!cancelled) {
          setLiveApplications(response.items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConnectionError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const usingLiveData = liveApplications !== null;
  const applications = liveApplications ?? [];
  const visibleApplications = empty ? [] : applications;

  return (
    <OperationsShell>
      <header className={styles.pageHeading}>
        <div>
          <p>업사이클링 운영</p>
          <h1>신청 목록</h1>
          <span>접수된 제품을 확인하고 담당 공정을 진행합니다.</span>
        </div>
        <div className={styles.summaryMetric} aria-label="현재 신청 수">
          <span>전체 신청</span>
          <strong>{visibleApplications.length}</strong>
          <small>건</small>
        </div>
      </header>

      <aside className={styles.fixtureNotice} aria-label="운영 API 연결 상태">
        <strong>
          {usingLiveData
            ? "Supabase v2 연결"
            : connectionError
              ? "운영자 로그인 필요"
              : "Supabase v2 연결 중"}
        </strong>
        <span>
          {usingLiveData
            ? "운영자 인증으로 실제 신청 목록을 조회하고 있습니다."
            : connectionError
              ? "운영자 계정으로 로그인하면 실제 신청 목록을 조회할 수 있습니다."
              : "운영 API에서 신청 목록을 불러오고 있습니다."}
        </span>
      </aside>

      <section aria-labelledby="application-list-heading">
        <div className={styles.sectionHeading}>
          <h2 id="application-list-heading">진행 중인 신청</h2>
          <span>{visibleApplications.length}건</span>
        </div>

        {visibleApplications.length === 0 ? (
          <>
            {connectionError ? (
              <OperatorLoginPanel
                onAuthenticated={() => {
                  setConnectionError(false);
                  setLiveApplications(null);
                  setReloadToken((value) => value + 1);
                }}
              />
            ) : (
              <Card className={styles.emptyState} tone="outline">
                <strong>표시할 신청이 없습니다.</strong>
                <p>새 신청이 접수되면 이 목록에서 확인할 수 있습니다.</p>
                <Link href="/operations">목록 새로고침</Link>
              </Card>
            )}
          </>
        ) : (
          <div className={styles.tableFrame}>
            <table className={styles.applicationTable}>
              <caption className={styles.visuallyHidden}>
                업사이클링 신청 목록
              </caption>
              <thead>
                <tr>
                  <th scope="col">신청 상품</th>
                  <th scope="col">신청 번호</th>
                  <th scope="col">담당</th>
                  <th scope="col">현재 상태</th>
                  <th scope="col">신청일</th>
          <th scope="col">금액</th>
                  <th aria-label="상세 이동" scope="col" />
                </tr>
              </thead>
              <tbody>
                {visibleApplications.map((application) => {
                  const applicationStatus = readOperationStatus(application.effectiveStatus);
                  const stage = OPERATION_STAGE_PRESENTATION[applicationStatus];
                  const confirmed = hasConfirmedInspection(applicationStatus);
                  const displayedPriceKrw = application.product.mockPrice.amount;
                  const image = application.product.listImage;
                  const date = formatApplicationDate(application.createdAt);
                  const applicationId = application.id;

                  return (
                    <tr key={applicationId}>
                      <td>
                        <div className={styles.productCell}>
                          <span className={styles.productThumb}>
                            <Image
                              alt=""
                              fill
                              sizes="56px"
                              src={image}
                            />
                          </span>
                          <div>
                            <strong>{application.product.name}</strong>
                            <span>
                              {application.customer.displayName}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td data-label="신청 번호">
                        <code>{application.applicationNumber}</code>
                      </td>
                      <td data-label="담당">{stage.owner}</td>
                      <td data-label="현재 상태">
                        <span className={styles.statusBadge}>{stage.label}</span>
                      </td>
                      <td data-label="신청일">{date}</td>
                      <td data-label={confirmed ? "확정 금액" : "예상 금액"}>
                        {formatKrw(displayedPriceKrw)}
                      </td>
                      <td className={styles.tableAction}>
                        <Link
                          href={operationDetailHref(
                            applicationStatus,
                            applicationId,
                          )}
                        >
                          상세 보기
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </OperationsShell>
  );
}

function formatApplicationDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("ko-KR");
}

function formatKrw(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
}
