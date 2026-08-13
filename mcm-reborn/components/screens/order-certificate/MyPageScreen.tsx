import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { Button, ButtonLink } from "@/components/ui/Button";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { DEMO_ORDER } from "./demo-data";
import type { DemoState } from "./demo-state";
import { DemoStatePanel } from "./DemoStatePanel";
import styles from "./order-certificate.module.css";

type MyPageScreenProps = {
  state: Extract<DemoState, "normal" | "loading" | "empty" | "error">;
};

export function MyPageScreen({ state }: MyPageScreenProps) {
  return (
    <AppShell
      footer={<BottomNav active="profile" />}
      header={<PageHeader backHref="/" title="마이페이지" />}
    >
      {state !== "normal" ? (
        <div className={styles.stateInset}>
          <DemoStatePanel
            emptyDescription="표시할 데모 프로필 정보가 없습니다."
            retryHref="/mypage"
            state={state}
            subject="프로필 정보"
          />
        </div>
      ) : (
        <div className={styles.profileLayout}>
          <Section
            action={
              <button className={styles.textLink} disabled type="button">
                수정하기
              </button>
            }
            title="프로필 정보"
          >
            <KeyValueList
              items={[
                { label: "이름", value: DEMO_ORDER.customer.name },
                { label: "휴대폰", value: DEMO_ORDER.customer.phone },
                {
                  label: "주소지",
                  value: `${DEMO_ORDER.customer.address} ${DEMO_ORDER.customer.addressDetail}`,
                },
                { label: "비밀번호", value: "••••••••" },
              ]}
            />
          </Section>

          <Section
            action={
              <button className={styles.textLink} disabled type="button">
                매장 설정
              </button>
            }
            title="기본 설정"
          >
            <div className={styles.preferenceRow}>
              <span aria-hidden="true" className={styles.bookmarkMark} />
              <span>선호하는 MCM 매장</span>
              <strong>명동 데모 스토어</strong>
            </div>
          </Section>

          <div className={styles.accountActions}>
            <ButtonLink fullWidth href="/login">
              로그아웃
            </ButtonLink>
            <Button disabled fullWidth variant="danger">
              계정 탈퇴
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
