"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { formatKrw } from "@/data/demo-scenario";
import {
  hasConfirmedInspection,
  OPERATION_APPLICATION,
  OPERATION_STAGE_PRESENTATION,
  operationDetailHref,
  readOperationStatus,
  type OperationStatus,
} from "./operations-data";
import {
  operatorFetch,
  type OperatorApplicationSummary,
  type OperatorApplicationPage,
} from "./operator-client";
import { OperationsShell } from "./OperationsShell";
import styles from "./operations.module.css";

type OperationsListScreenProps = {
  empty: boolean;
  status: OperationStatus;
};

export function OperationsListScreen({
  empty,
  status,
}: OperationsListScreenProps) {
  const [liveApplications, setLiveApplications] = useState<
    OperatorApplicationSummary[] | null
  >(null);
  const [connectionError, setConnectionError] = useState(false);

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
  }, []);

  const usingLiveData = liveApplications !== null;
  const applications = usingLiveData
    ? liveApplications
    : [OPERATION_APPLICATION];
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

      <aside className={styles.fixtureNotice} aria-label="데모 데이터 안내">
        <strong>{usingLiveData ? "Supabase v2 연결" : "데모 화면"}</strong>
        <span>
          {usingLiveData
            ? "운영자 인증으로 실제 신청 목록을 조회하고 있습니다."
            : connectionError
              ? "운영자 인증 또는 API 조회에 실패해 중앙 데모 데이터를 표시합니다."
              : "운영 API를 확인하는 중이며, 잠시 동안 중앙 데모 데이터를 표시합니다."}
        </span>
      </aside>

      <section aria-labelledby="application-list-heading">
        <div className={styles.sectionHeading}>
          <h2 id="application-list-heading">진행 중인 신청</h2>
          <span>{visibleApplications.length}건</span>
        </div>

        {visibleApplications.length === 0 ? (
          <Card className={styles.emptyState} tone="outline">
            <strong>표시할 신청이 없습니다.</strong>
            <p>
              {usingLiveData
                ? "새 신청이 접수되면 이 목록에서 확인할 수 있습니다."
                : "중앙 데모 데이터에 등록된 신청이 없습니다."}
            </p>
            <Link href="/operations">목록 새로고침</Link>
          </Card>
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
                  const isLiveApplication = "effectiveStatus" in application;
                  const applicationStatus = isLiveApplication
                    ? readOperationStatus(application.effectiveStatus)
                    : status;
                  const stage = OPERATION_STAGE_PRESENTATION[applicationStatus];
                  const confirmed = hasConfirmedInspection(applicationStatus);
                  const displayedPriceKrw = isLiveApplication
                    ? application.product.mockPrice.amount
                    : confirmed
                      ? OPERATION_APPLICATION.expertInspection.revisedPriceKrw
                      : OPERATION_APPLICATION.product.initialPriceKrw;
                  const image = isLiveApplication
                    ? application.product.listImage
                    : OPERATION_APPLICATION.product.image;
                  const date = isLiveApplication
                    ? formatApplicationDate(application.createdAt)
                    : OPERATION_APPLICATION.orderedAt;
                  const applicationId = isLiveApplication
                    ? application.id
                    : OPERATION_APPLICATION.applicationId;

                  return (
                    <tr key={applicationId}>
                      <td>
                        <div className={styles.productCell}>
                          <span className={styles.productThumb}>
                            <Image
                              alt=""
                              fill
                              sizes="56px"
                              src={image || OPERATION_APPLICATION.product.image}
                            />
                          </span>
                          <div>
                            <strong>{application.product.name}</strong>
                            <span>
                              {isLiveApplication
                                ? application.customer.displayName
                                : OPERATION_APPLICATION.sourceProduct.name}
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
