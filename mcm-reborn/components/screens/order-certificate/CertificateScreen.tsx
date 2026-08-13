import Image from "next/image";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/Button";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { DEMO_ORDER, DEMO_PASSPORT } from "./demo-data";
import type { DemoState } from "./demo-state";
import { DemoStatePanel } from "./DemoStatePanel";
import styles from "./order-certificate.module.css";

type CertificateScreenProps = {
  state: Extract<DemoState, "normal" | "loading" | "empty" | "error">;
};

export function CertificateScreen({ state }: CertificateScreenProps) {
  return (
    <AppShell header={<PageHeader backHref="/orders/demo" />}>
      {state !== "normal" ? (
        <div className={styles.stateInset}>
          <DemoStatePanel
            emptyDescription="완료된 데모 신청에 연결된 ESG Passport 기록이 아직 없습니다."
            retryHref="/certificates/demo"
            state={state}
            subject="ESG Passport"
          />
        </div>
      ) : (
        <div className={styles.certificateLayout}>
          <section className={styles.certificateHero}>
            <Image
              alt="MCM 날개 로고"
              className={styles.certificateLogo}
              height={116}
              priority
              src="/assets/mvp-beta/brand-mcm-wing-logo.png"
              width={132}
            />
            <p>DEMO UPCYCLING PASSPORT</p>
            <h1>MCM RE:BORN</h1>
          </section>

          <div className={styles.divider} />
          <KeyValueList
            items={[
              { label: "기록번호", value: DEMO_PASSPORT.id },
              { label: "생성일", value: DEMO_PASSPORT.createdAt },
              { label: "제품", value: DEMO_ORDER.product.name },
              {
                label: "예상 원단 재활용률",
                value: DEMO_ORDER.product.recycleRate,
              },
              { label: "제작 파트너", value: DEMO_PASSPORT.artisan },
            ]}
          />
          <p className={styles.legalDemoNote}>
            이 화면은 해커톤 데모용 업사이클링 기록입니다. 법적 효력이나 제품 상태에 대한 보장을 제공하지 않습니다.
          </p>

          <Section
            description="아래 진입 수단은 인터랙션이 없는 UI 미리보기입니다."
            title="Passport 열기"
          >
            <div className={styles.passportEntryGrid}>
              {/* TODO(post-beta): NFC 태그 딥링크 연동 */}
              <button
                aria-describedby="passport-post-beta"
                className={styles.passportEntry}
                disabled
                type="button"
              >
                <span aria-hidden="true" className={styles.nfcMark}>
                  NFC
                </span>
                <span>NFC 태그</span>
              </button>
              {/* TODO(post-beta): QR 공개 검증 URL 연동 */}
              <button
                aria-describedby="passport-post-beta"
                className={styles.passportEntry}
                disabled
                type="button"
              >
                <Image
                  alt=""
                  aria-hidden="true"
                  height={15}
                  src="/assets/mvp-beta/icon-barcode.svg"
                  width={18}
                />
                <span>QR 코드</span>
              </button>
            </div>
            <p className={styles.postBetaNote} id="passport-post-beta">
              TODO(post-beta): NFC·QR 진입 및 공개 URL 연결
            </p>
          </Section>

          <div className={styles.certificateActions}>
            {/* TODO(post-beta): Passport 파일 발급 */}
            <Button disabled fullWidth>
              Passport 발급 준비 중
            </Button>
            {/* TODO(post-beta): Web Share API 및 공유 링크 */}
            <Button disabled fullWidth variant="ghost">
              공유하기
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
