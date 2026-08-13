import Image from "next/image";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/Button";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { ProgressStepper } from "@/components/ui/ProgressStepper";
import { DEMO_ORDER, DEMO_PASSPORT } from "./demo-data";
import type { DemoState } from "./demo-state";
import { DemoStatePanel } from "./DemoStatePanel";
import styles from "./order-certificate.module.css";

type CertificateScreenProps = {
  state: Extract<
    DemoState,
    | "normal"
    | "loading"
    | "empty"
    | "error"
    | "permission"
    | "locked"
  >;
};

export function CertificateScreen({ state }: CertificateScreenProps) {
  return (
    <AppShell header={<PageHeader backHref="/orders/demo" />}>
      {state !== "normal" ? (
        <div className={styles.stateInset}>
          <h1 className={styles.visuallyHidden}>디지털 ESG Passport</h1>
          <DemoStatePanel
            emptyDescription="완료된 데모 신청에 연결된 ESG Passport 기록이 아직 없습니다."
            lockedDescription="신청이 완료된 뒤 ESG Passport가 발급됩니다. 현재 신청 상태를 먼저 확인해 주세요."
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
              style={{ height: "auto" }}
              width={132}
            />
            <p>CERTIFICATE OF UPCYCLING</p>
            <h1>MCM RE:BORN</h1>
          </section>

          <div className={styles.divider} />
          <KeyValueList
            dividers
            items={[
              { label: "Certificate ID", value: DEMO_PASSPORT.certificateId },
              {
                label: "보증서 번호",
                value: DEMO_PASSPORT.certificateNumber,
              },
              { label: "신청 번호", value: DEMO_ORDER.applicationNumber },
              { label: "원본 제품군", value: DEMO_PASSPORT.sourceCategory },
              { label: "RE:BORN 제품", value: DEMO_ORDER.product.name },
              {
                label: "재사용 소재 비율",
                value: DEMO_ORDER.product.recycleRate,
              },
              {
                label: "재사용 면적",
                value: `${DEMO_PASSPORT.reusedAreaCm2.toLocaleString("ko-KR")}cm²`,
              },
              {
                label: "예상 탄소 절감량",
                value: `${DEMO_PASSPORT.estimatedCarbonSavingKgCo2e}kgCO₂e`,
              },
              {
                label: "산정 방법론",
                value: DEMO_PASSPORT.methodologyVersion,
              },
              { label: "발급일", value: DEMO_PASSPORT.issuedAt },
              { label: "검증 코드", value: DEMO_PASSPORT.verificationCode },
              { label: "제작 파트너", value: DEMO_PASSPORT.artisan },
            ]}
          />
          <p className={styles.legalDemoNote}>
            {DEMO_PASSPORT.disclaimer} 탄소 절감량은 DEMO_LCA_V1 기반 추정치로
            공인 ESG 수치가 아니며, 제품 상태에 대한 보장을 제공하지 않습니다.
          </p>

          <Section
            description="원본 제품에서 RE:BORN 제품과 Passport 기록으로 이어지는 완료 상태 데모 여정입니다."
            title="업사이클링 여정"
          >
            <ProgressStepper
              currentIndex={5}
              items={["접수", "분석", "실물 검수", "장인 제작", "배송", "Passport"]}
            />
          </Section>

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
                  className={styles.passportBarcode}
                  height={15}
                  src="/assets/mvp-beta/icon-barcode.svg"
                  width={18}
                />
                <span>QR 코드</span>
              </button>
            </div>
            <p className={styles.postBetaNote} id="passport-post-beta">
              NFC·QR 진입과 공개 검증 URL은 정식 연동 후 제공됩니다.
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
