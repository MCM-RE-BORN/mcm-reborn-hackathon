import Image from "next/image";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { DEMO_ORDER } from "./demo-data";
import type { DemoState } from "./demo-state";
import { DemoStatePanel } from "./DemoStatePanel";
import styles from "./order-certificate.module.css";

type OrderCompleteScreenProps = {
  state: Extract<DemoState, "normal" | "loading" | "empty" | "error">;
};

export function OrderCompleteScreen({ state }: OrderCompleteScreenProps) {
  return (
    <AppShell header={<PageHeader backHref="/checkout" />}>
      {state !== "normal" ? (
        <div className={styles.stateInset}>
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
            <h1>신청이 확정되었습니다</h1>
            <p>
              신청번호 <u>{DEMO_ORDER.applicationNumber}</u>
            </p>
          </div>
          <ButtonLink fullWidth href="/orders/demo">
            신청 내역 확인하기
          </ButtonLink>
          <p className={styles.demoCaption}>
            데모 주문이며 실제 결제·수거 요청은 발생하지 않습니다.
          </p>
        </section>
      )}
    </AppShell>
  );
}
