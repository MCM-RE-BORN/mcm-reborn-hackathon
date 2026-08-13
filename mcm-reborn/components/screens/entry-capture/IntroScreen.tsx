import Image from "next/image";
import { AppShell } from "@/components/layout/AppShell";
import { ButtonLink } from "@/components/ui/Button";
import { StatusPanel } from "@/components/ui/StatusPanel";
import type { PageState } from "./page-state";
import styles from "./entry-capture.module.css";

type IntroScreenProps = {
  state: PageState;
};

const STEPS = [
  {
    index: "01",
    title: "제품 사진 등록",
    description: "보유한 MCM 가방·지갑·액세서리의 모습을 선명하게 등록해요.",
  },
  {
    index: "02",
    title: "AI 사전 분석",
    description: "사진으로 소재 상태와 예상 재활용 가능 범위를 확인해요.",
  },
  {
    index: "03",
    title: "추천 디자인 선택",
    description: "기존 계약의 파우치·카드지갑·키링 후보를 비교해요.",
  },
  {
    index: "04",
    title: "3D 목업 확인",
    description: "선택한 디자인의 정적 3D 미리보기와 제작 제약을 확인해요.",
  },
  {
    index: "05",
    title: "신청·실물 검수·제작",
    description: "신청 후 실물 검수 조건을 확인하고 장인 제작을 기다려요.",
  },
  {
    index: "06",
    title: "완료·ESG Passport",
    description: "완료 건의 제작 여정과 데모 ESG 기록을 확인해요.",
  },
];

function IntroUnavailable({ state }: { state: PageState }) {
  if (state === "loading") {
    return (
      <StatusPanel
        description="공식 업사이클링 서비스 안내를 준비하고 있어요."
        title="서비스 소개를 불러오는 중"
        tone="loading"
      />
    );
  }

  if (state === "error" || state === "empty") {
    return (
      <StatusPanel
        action={
          <ButtonLink fullWidth href="/intro" variant="outline">
            다시 불러오기
          </ButtonLink>
        }
        description="잠시 후 다시 시도하거나 홈에서 베타 화면을 둘러보세요."
        title="소개 콘텐츠를 불러오지 못했어요"
        tone={state === "error" ? "error" : "empty"}
      />
    );
  }

  if (state === "permission" || state === "limited") {
    return (
      <StatusPanel
        action={
          <ButtonLink fullWidth href="/" variant="outline">
            홈에서 둘러보기
          </ButtonLink>
        }
        description="이 기기에서는 일부 소개 콘텐츠만 이용할 수 있어요. 홈에서 베타 흐름을 계속 확인할 수 있습니다."
        title="소개 화면 이용이 제한되어 있어요"
        tone="permission"
      />
    );
  }

  return null;
}

export function IntroScreen({ state }: IntroScreenProps) {
  const showContent = state === "normal";

  return (
    <AppShell contentClassName={styles.introContent}>
      <header className={styles.introBrand}>
        <Image
          alt="MCM"
          className={styles.introLogo}
          height={70}
          priority
          src="/assets/mvp-beta/brand-mcm-wing-logo.png"
          width={80}
        />
        <p>MCM RE:BORN BETA</p>
      </header>

      {showContent ? (
        <>
          <section className={styles.introHero}>
            <p className={styles.eyebrow}>OFFICIAL UPCYCLING SERVICE</p>
            <h1>
              당신의 MCM에
              <br />새로운 쓰임을
            </h1>
            <p>
              사용하지 않는 MCM 제품을 분석하고, 나만의 디자인으로 다시
              만나는 공식 업사이클링 여정입니다.
            </p>
          </section>

          <ol className={styles.introSteps} aria-label="서비스 이용 순서">
            {STEPS.map((step) => (
              <li key={step.index}>
                <span aria-hidden="true">{step.index}</span>
                <div>
                  <h2>{step.title}</h2>
                  <p>{step.description}</p>
                </div>
              </li>
            ))}
          </ol>

          <aside className={styles.notice}>
            대상은 업사이클링을 검토할 MCM 가방·지갑·액세서리입니다. AI 분석과
            3D 목업은 제작 전 예상 결과이며, 실물 검수와 수작업 제작에 따라 조건
            또는 완성품이 달라질 수 있어요. AI는 정품을 판정하지 않으며, 추가
            확인 신호가 있으면 수동 검토 전까지 신청이 보류됩니다. NFC·QR
            Passport 열기는 현재 UI 미리보기로만 제공합니다.
          </aside>
        </>
      ) : (
        <>
          <h1 className={styles.visuallyHidden}>MCM RE:BORN 서비스 소개</h1>
          <IntroUnavailable state={state} />
        </>
      )}

      <div className={styles.introActions}>
        <ButtonLink fullWidth href="/login">
          시작하기
        </ButtonLink>
        <ButtonLink fullWidth href="/" variant="ghost">
          먼저 둘러보기
        </ButtonLink>
      </div>
    </AppShell>
  );
}
