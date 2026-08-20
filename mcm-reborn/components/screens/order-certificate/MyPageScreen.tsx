"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { ActionButtonLink } from "@/components/ui/ActionButtonLink";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { SectionBand } from "@/components/ui/SectionBand";
import { StatusPanel } from "@/components/ui/StatusPanel";
import type { DemoState } from "./demo-state";
import { DemoLogoutButton } from "./DemoLogoutButton";
import { DemoStatePanel } from "./DemoStatePanel";
import {
  applicationStatusToOrderStage,
  customerFetch,
  readJsonString,
  type CustomerApplicationDetail,
  type CustomerApplicationPage,
  type CustomerMe,
} from "./customer-client";
import fieldStyles from "@/components/ui/ui.module.css";
import styles from "./order-certificate.module.css";

type MyPageScreenProps = {
  state: Extract<
    DemoState,
    "normal" | "loading" | "empty" | "error" | "permission"
  >;
};

function AccordionChevron() {
  return (
    <span
      aria-hidden="true"
      className={`${fieldStyles.chevronMark} ${styles.accordionMark}`}
    />
  );
}

export function MyPageScreen({ state }: MyPageScreenProps) {
  const [profile, setProfile] = useState<CustomerMe | null>(null);
  const [latestApplication, setLatestApplication] =
    useState<CustomerApplicationDetail | null>(null);
  const [hasIssuedCertificate, setHasIssuedCertificate] = useState(false);
  const [requestError, setRequestError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      try {
        const [me, applications] = await Promise.all([
          customerFetch<CustomerMe>("/api/v2/me"),
          customerFetch<CustomerApplicationPage>("/api/v2/applications?size=50"),
        ]);
        const latest = applications.items[0];
        const detail = latest
          ? await customerFetch<CustomerApplicationDetail>(
              `/api/v2/applications/${latest.id}`,
            )
          : null;
        const issuedCertificate = applications.items.some(
          (application) =>
            applicationStatusToOrderStage(application.status) === "completed",
        );
        if (!cancelled) {
          setProfile(me);
          setLatestApplication(detail);
          setHasIssuedCertificate(issuedCertificate);
        }
      } catch {
        if (!cancelled) {
          setRequestError(true);
        }
      }
    }
    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  const address = latestApplication?.shippingAddress;
  const addressText = [
    readJsonString(address, "address1") || readJsonString(address, "address"),
    readJsonString(address, "address2") || readJsonString(address, "addressDetail"),
  ]
    .filter(Boolean)
    .join(" ");
  const phone = readJsonString(address, "phone");
  const certificateHref = hasIssuedCertificate
    ? "/orders?view=applications"
    : "/certificates/demo?state=locked";

  return (
    <AppShell
      footer={<BottomNav active="mypage" />}
      header={<PageHeader title="마이페이지" />}
    >
      {state !== "normal" ? (
        <div className={styles.stateInset}>
          <DemoStatePanel
            emptyDescription="표시할 프로필 정보가 없습니다."
            retryHref="/mypage"
            state={state}
            subject="프로필 정보"
          />
        </div>
      ) : requestError ? (
        <div className={styles.stateInset}>
          <DemoStatePanel
            emptyDescription="프로필 정보를 불러오지 못했습니다."
            retryHref="/mypage"
            state="error"
            subject="프로필 정보"
          />
        </div>
      ) : !profile ? (
        <div className={styles.stateInset}>
          <StatusPanel
            description="정보를 불러오고 있습니다."
            title="프로필 정보를 확인하고 있어요"
            tone="loading"
          />
        </div>
      ) : (
        <div className={styles.profileLayout}>
          <Section
            action={<AccordionChevron />}
            className={styles.myPageSection}
            title="프로필 정보"
          >
            <KeyValueList
              className={styles.profileList}
              items={[
                { label: "이름", value: profile.displayName },
                { label: "이메일", value: profile.email },
                { label: "휴대폰", value: phone || "등록된 정보 없음" },
                { label: "주소지", value: addressText || "등록된 수거지 없음" },
                { label: "비밀번호", value: "••••••••" },
              ]}
            />
            <div className={styles.profilePasswordAction}>
              <button
                className={`${styles.textLink} ${styles.profilePasswordLink}`}
                disabled
                type="button"
              >
                수정하기
              </button>
            </div>
          </Section>

          <SectionBand />

          <Section
            action={<AccordionChevron />}
            className={styles.myPageSection}
            title="기본 설정"
          >
            <div className={styles.preferenceRow}>
              <svg
                aria-hidden="true"
                className={styles.bookmarkMark}
                fill="none"
                height="15"
                viewBox="0 0 12 15"
                width="12"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M10.6667 0H1.33333C0.979711 0 0.640573 0.126431 0.390524 0.351479C0.140476 0.576527 0 0.881758 0 1.20002V14.4003C5.91978e-05 14.5074 0.0319563 14.6125 0.0923815 14.7047C0.152807 14.797 0.239558 14.873 0.343633 14.9249C0.447708 14.9767 0.565315 15.0026 0.684249 14.9998C0.803182 14.997 0.919109 14.965 1.02 14.9088L6 12.1075L10.9808 14.9088C11.0817 14.9654 11.1972 14.9966 11.3164 14.9993C11.4352 15.0021 11.5526 14.9762 11.6566 14.9243C11.7607 14.8724 11.8472 14.7965 11.9075 14.7044C11.9679 14.6122 11.9998 14.5074 12 14.4003V1.20002C12 0.881758 11.8595 0.576527 11.6095 0.351479C11.3594 0.126431 11.0203 0 10.6667 0ZM10.6667 13.318L6.3525 10.8917C6.24655 10.8321 6.12411 10.8005 5.99917 10.8005C5.87422 10.8005 5.75179 10.8321 5.64583 10.8917L1.33333 13.318V1.20002H10.6667V13.318Z"
                  fill="currentColor"
                />
              </svg>
              <span>선호하는 MCM 매장</span>
              <button className={styles.textLink} disabled type="button">
                매장 설정
              </button>
            </div>
          </Section>

          <SectionBand />

          <ActionButtonLink
            className={styles.certificateAction}
            fullWidth
            href={certificateHref}
          >
            나의 RE:BORN 인증서 보기
          </ActionButtonLink>

          <nav aria-label="계정 도움말" className={styles.footerLinks}>
            <button className={styles.textLink} disabled type="button">
              고객센터
            </button>
            <span aria-hidden="true" />
            <DemoLogoutButton />
          </nav>
        </div>
      )}
    </AppShell>
  );
}
