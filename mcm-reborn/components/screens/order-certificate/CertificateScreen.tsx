"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { ButtonLink } from "@/components/ui/Button";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { ProgressStepper } from "@/components/ui/ProgressStepper";
import { StatusPanel } from "@/components/ui/StatusPanel";
import type { DemoState } from "./demo-state";
import { DemoStatePanel } from "./DemoStatePanel";
import { formatApiDate } from "@/lib/formatters";
import { customerFetch, type CustomerCertificate } from "./customer-client";
import styles from "./order-certificate.module.css";

type CertificateScreenProps = {
  applicationId?: string;
  state: Extract<
    DemoState,
    "normal" | "loading" | "empty" | "error" | "permission" | "locked"
  >;
};

export function CertificateScreen({
  applicationId,
  state,
}: CertificateScreenProps) {
  const [certificate, setCertificate] = useState<CustomerCertificate | null>(null);
  const [requestError, setRequestError] = useState(false);

  useEffect(() => {
    if (state !== "normal" || !applicationId) {
      return;
    }
    let cancelled = false;
    customerFetch<CustomerCertificate>(
      `/api/v2/applications/${applicationId}/certificate`,
    )
      .then((response) => {
        if (!cancelled) {
          setCertificate(response);
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
  }, [applicationId, state]);

  const backHref = applicationId
    ? `/orders/demo?applicationId=${applicationId}`
    : "/orders";

  return (
    <AppShell header={<PageHeader backHref={backHref} />}>
      {state !== "normal" ? (
        <div className={styles.stateInset}>
          <h1 className={styles.visuallyHidden}>디지털 ESG Passport</h1>
          <DemoStatePanel
            emptyDescription="완료된 신청에 연결된 ESG Passport가 아직 없습니다."
            lockedDescription="제작과 품질 확인이 완료된 뒤 ESG Passport가 발급됩니다. 신청 상태를 먼저 확인해 주세요."
            retryHref={backHref}
            state={state}
            subject="ESG Passport"
          />
        </div>
      ) : requestError || !applicationId ? (
        <div className={styles.stateInset}>
          <DemoStatePanel
            emptyDescription="발급된 ESG Passport를 찾지 못했습니다."
            retryHref="/orders"
            state="error"
            subject="ESG Passport"
          />
        </div>
      ) : !certificate ? (
        <div className={styles.stateInset}>
          <StatusPanel
            description="완료된 신청과 보증서 기록을 확인하고 있습니다."
            title="ESG Passport를 확인하고 있어요"
            tone="loading"
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
            <span>제작과 품질 확인을 모두 마친 제품에 발급된 디지털 보증서입니다.</span>
          </section>

          <div className={styles.divider} />
          <KeyValueList
            items={[
              { label: "보증서 번호", value: certificate.certificateNumber },
              { label: "신청 번호", value: certificate.applicationNumber },
              { label: "원본 제품군", value: certificate.sourceCategory },
              { label: "RE:BORN 제품", value: certificate.rebornProduct },
              {
                label: "최종 재사용 소재 비율",
                value: `${certificate.reusedMaterialRate}%`,
              },
              {
                label: "재사용 면적",
                value: `${certificate.reusedAreaCm2.toLocaleString("ko-KR")}cm²`,
              },
              {
                label: "예상 탄소 절감량",
                value: `${certificate.estimatedCarbonSavingKgCo2e}kgCO₂e`,
              },
              { label: "산정 기준", value: certificate.methodologyVersion },
              { label: "발급일", value: formatApiDate(certificate.issuedAt) },
              { label: "검증 코드", value: certificate.verificationCode },
            ]}
          />
          <p className={styles.legalDemoNote}>
            예상 탄소 절감량은 제품의 재사용 소재 면적을 바탕으로 산정한 참고값이며,
            제3자 공인 환경성적을 의미하지 않습니다.
          </p>

          <Section
            description="원본 제품의 AI 분석부터 전문가 실물 검수, 장인 제작과 품질 확인까지의 기록입니다."
            title="업사이클링 여정"
          >
            <ProgressStepper
              currentIndex={5}
              items={["AI 분석", "수거", "실물 검수", "장인 제작", "품질 확인", "Passport"]}
            />
          </Section>

          <div className={styles.certificateActions}>
            <ButtonLink fullWidth href={backHref}>
              완료 신청 보기
            </ButtonLink>
          </div>
        </div>
      )}
    </AppShell>
  );
}
