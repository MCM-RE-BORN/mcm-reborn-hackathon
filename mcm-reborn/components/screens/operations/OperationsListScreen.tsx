import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { formatKrw } from "@/data/demo-scenario";
import {
  OPERATION_APPLICATION,
  OPERATION_STAGE_PRESENTATION,
  OPERATION_STATUSES,
  operationDetailHref,
  type OperationStatus,
} from "./operations-data";
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
  const stage = OPERATION_STAGE_PRESENTATION[status];
  const hasConfirmedInspection =
    OPERATION_STATUSES.indexOf(status) >=
    OPERATION_STATUSES.indexOf("PRODUCTION_READY");
  const displayedPriceKrw = hasConfirmedInspection
    ? OPERATION_APPLICATION.expertInspection.revisedPriceKrw
    : OPERATION_APPLICATION.product.initialPriceKrw;
  const priceLabel = hasConfirmedInspection ? "확정 금액" : "예상 금액";

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
          <strong>{empty ? 0 : 1}</strong>
          <small>건</small>
        </div>
      </header>

      <aside className={styles.fixtureNotice} aria-label="데모 데이터 안내">
        <strong>중앙 데모 데이터</strong>
        <span>
          이 콘솔은 아직 운영 API에 저장하지 않으며, 버튼으로 v2 상태 전이를
          재현합니다.
        </span>
      </aside>

      <section aria-labelledby="application-list-heading">
        <div className={styles.sectionHeading}>
          <h2 id="application-list-heading">진행 중인 신청</h2>
          <span>{empty ? "0건" : "1건"}</span>
        </div>

        {empty ? (
          <Card className={styles.emptyState} tone="outline">
            <strong>표시할 신청이 없습니다.</strong>
            <p>새 신청이 접수되면 이 목록에서 확인할 수 있습니다.</p>
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
                  <th scope="col">{priceLabel}</th>
                  <th aria-label="상세 이동" scope="col" />
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div className={styles.productCell}>
                      <span className={styles.productThumb}>
                        <Image
                          alt=""
                          fill
                          sizes="56px"
                          src={OPERATION_APPLICATION.product.image}
                        />
                      </span>
                      <div>
                        <strong>{OPERATION_APPLICATION.product.name}</strong>
                        <span>{OPERATION_APPLICATION.sourceProduct.name}</span>
                      </div>
                    </div>
                  </td>
                  <td data-label="신청 번호">
                    <code>{OPERATION_APPLICATION.applicationNumber}</code>
                  </td>
                  <td data-label="담당">{stage.owner}</td>
                  <td data-label="현재 상태">
                    <span className={styles.statusBadge}>{stage.label}</span>
                  </td>
                  <td data-label="신청일">{OPERATION_APPLICATION.orderedAt}</td>
                  <td data-label={priceLabel}>
                    {formatKrw(displayedPriceKrw)}
                  </td>
                  <td className={styles.tableAction}>
                    <Link href={operationDetailHref(status)}>상세 보기</Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </OperationsShell>
  );
}
