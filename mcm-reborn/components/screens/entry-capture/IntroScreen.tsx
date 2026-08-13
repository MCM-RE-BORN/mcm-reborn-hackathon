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
    title: "AI 사전 분석",
    description: "보유한 MCM 제품의 상태와 예상 재활용률을 먼저 확인해요.",
  },
  {
    index: "02",
    title: "맞춤 디자인 선택",
    description: "제품 소재에 맞춘 디자인과 3D 목업을 비교해요.",
  },
  {
    index: "03",
    title: "공식 장인 제작",
    description: "실물 검수 이후 MCM 장인이 새로운 쓰임을 완성해요.",
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

  return null;
}

export function IntroScreen({ state }: IntroScreenProps) {
  const unavailable = <IntroUnavailable state={state} />;

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

      {unavailable || (
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
            AI 분석과 3D 목업은 제작 전 예상 결과입니다. 실물 검수와 수작업
            제작 결과에 따라 조건 또는 완성품이 달라질 수 있어요. 정품 확인이
            어렵거나 가품으로 판정된 제품은 제작 신청이 제한됩니다.
          </aside>
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
