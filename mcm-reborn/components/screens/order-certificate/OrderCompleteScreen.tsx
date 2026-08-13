import Image from "next/image";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { DEMO_PENDING_APPLICATION } from "./demo-data";
import type { DemoState } from "./demo-state";
import { DemoStatePanel } from "./DemoStatePanel";
import styles from "./order-certificate.module.css";

type OrderCompleteScreenProps = {
  state: Extract<
    DemoState,
    "normal" | "loading" | "empty" | "error" | "permission"
  >;
};

export function OrderCompleteScreen({ state }: OrderCompleteScreenProps) {
  return (
    <AppShell header={<PageHeader backHref="/checkout" />}>
      {state !== "normal" ? (
        <div className={styles.stateInset}>
          <h1 className={styles.visuallyHidden}>신청 완료</h1>
          <DemoStatePanel
            emptyDescription="완료된 신청을 찾지 못했습니다. 신청 내역에서 상태를 다시 확인해 주세요."
            retryHref="/orders/demo/complete"
            state={state}
            subject="신청 완료 정보"
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
            <h1>데모 결제가 완료되어 신청이 접수되었습니다</h1>
            <p>
              신청번호 <u>{DEMO_PENDING_APPLICATION.applicationNumber}</u>
            </p>
            <p>
              현재 상태: {DEMO_PENDING_APPLICATION.applicationStatus} · 승인 대기
            </p>
          </div>
          <ButtonLink fullWidth href="/orders/demo">
            진행 완료 데모 신청 보기
          </ButtonLink>
          <p className={styles.demoCaption}>
            실제 결제·수거 요청은 발생하지 않습니다. 다음 화면은 Passport까지
            확인할 수 있는 별도의 완료 상태 데모 신청입니다.
          </p>
        </section>
      )}
    </AppShell>
  );
}
