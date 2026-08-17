import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { ButtonLink } from "@/components/ui/Button";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { ProgressStepper } from "@/components/ui/ProgressStepper";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { DEMO_SCENARIO } from "@/data/demo-scenario";
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
  verification?: "nfc" | "qr";
};

export function CertificateScreen({
  state,
  verification,
}: CertificateScreenProps) {
  const { certificate, order, selectedDesign, sourceProduct } = DEMO_SCENARIO;

  return (
    <AppShell
      footer={
        <BottomNav
          active="certificate"
          certificateState={state === "normal" ? "issued" : "locked"}
        />
      }
      header={<PageHeader backHref="/orders/demo?stage=completed" />}
    >
      {state !== "normal" ? (
        <div className={styles.stateInset}>
          <h1 className={styles.visuallyHidden}>디지털 ESG Passport</h1>
          <DemoStatePanel
            emptyDescription="완료된 주문에 연결된 ESG Passport가 아직 없습니다."
            lockedDescription="제작과 품질 확인이 완료된 뒤 ESG Passport가 발급됩니다. 현재 주문 상태를 먼저 확인해 주세요."
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
            <span>
              제작과 품질 확인을 모두 마친 제품에 발급된 디지털 보증서입니다.
            </span>
          </section>

          <div className={styles.divider} />
          <KeyValueList
            dividers
            items={[
              { label: "보증서 번호", value: certificate.number },
              { label: "주문 번호", value: order.number },
              { label: "원본 제품", value: sourceProduct.name },
              { label: "원본 제품군", value: sourceProduct.category },
              { label: "RE:BORN 제품", value: selectedDesign.name },
              {
                label: "최종 재사용 소재 비율",
                value: `${certificate.verifiedReuseRate}%`,
              },
              {
                label: "재사용 면적",
                value: `${certificate.reusedAreaCm2.toLocaleString("ko-KR")}cm²`,
              },
              {
                label: "예상 탄소 절감량",
                value: `${certificate.estimatedCarbonSavingKgCo2e}kgCO₂e`,
              },
              {
                label: "산정 기준",
                value: "MCM RE:BORN 순환성 추정 모델 v2",
              },
              { label: "제작 완료일", value: certificate.completedAt },
              { label: "발급일", value: certificate.issuedAt },
              { label: "검증 코드", value: certificate.verificationCode },
              { label: "제작 파트너", value: certificate.artisan },
            ]}
          />
          <p className={styles.legalDemoNote}>
            예상 탄소 절감량은 제품의 재사용 소재 면적을 바탕으로 산정한
            참고값이며, 제3자 공인 환경성적을 의미하지 않습니다.
          </p>

          <Section
            description="원본 가방의 AI 분석부터 전문가 실물 검수, 장인 제작과 품질 확인까지의 기록입니다."
            title="업사이클링 여정"
          >
            <ProgressStepper
              currentIndex={5}
              items={[
                "AI 분석",
                "수거",
                "실물 검수",
                "장인 제작",
                "품질 확인",
                "Passport",
              ]}
            />
          </Section>

          <Section
            description="제품에 적용될 NFC·QR 검증 화면을 미리 확인할 수 있습니다. 아래 항목은 준비된 시연용 코드입니다."
            title="보증서 검증 미리보기"
          >
            <div className={styles.passportEntryGrid}>
              <Link
                className={styles.passportEntry}
                href="/certificates/demo?state=issued&verify=nfc#passport-verification"
              >
                <span aria-hidden="true" className={styles.nfcMark}>
                  NFC
                </span>
                <span>NFC 화면 미리보기</span>
              </Link>
              <Link
                className={styles.passportEntry}
                href="/certificates/demo?state=issued&verify=qr#passport-verification"
              >
                <Image
                  alt=""
                  aria-hidden="true"
                  className={styles.passportBarcode}
                  height={15}
                  src="/assets/mvp-beta/icon-barcode.svg"
                  width={18}
                />
                <span>QR 화면 미리보기</span>
              </Link>
            </div>
            {verification ? (
              <div className={styles.verificationPanel} id="passport-verification">
                <StatusPanel
                  description={`시연용 ${
                    verification === "nfc" ? "NFC" : "QR"
                  } 화면에 표시될 보증서 번호 ${certificate.number}와 검증 코드 ${certificate.verificationCode}입니다. 실제 태그 스캔이나 외부 검증은 수행하지 않습니다.`}
                  title="검증 화면 미리보기"
                  tone="permission"
                />
              </div>
            ) : null}
          </Section>

          <div className={styles.certificateActions}>
            <ButtonLink
              fullWidth
              href="/orders/demo?stage=completed"
              variant="outline"
            >
              완료 주문 보기
            </ButtonLink>
          </div>
        </div>
      )}
    </AppShell>
  );
}
