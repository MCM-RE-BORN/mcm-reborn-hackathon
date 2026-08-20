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
    description: "보유한 MCM 가방·지갑·액세서리의 모습을 선명하게 등록합니다.",
  },
  {
    index: "02",
    title: "AI 사전 분석",
    description: "사진으로 소재 상태와 예상 재활용 가능 범위를 확인합니다.",
  },
  {
    index: "03",
    title: "추천 디자인 선택",
    description: "여권지갑·카드지갑·네임택·키링 후보의 예상 조건을 비교합니다.",
  },
  {
    index: "04",
    title: "3D 목업 확인",
    description: "완성 예상 모습을 여러 각도로 돌려보고 확대합니다.",
  },
  {
    index: "05",
    title: "신청·실물 검수·제작",
    description: "신청 후 실물 검수 조건을 확인하고 장인 제작을 기다립니다.",
  },
  {
    index: "06",
    title: "완료·ESG Passport",
    description: "완료 제품의 제작 여정과 자원순환 기록을 확인합니다.",
  },
];

function IntroUnavailable({ state }: { state: PageState }) {
  if (state === "loading") {
    return (
      <StatusPanel
        description="공식 업사이클링 서비스 안내를 준비하고 있습니다."
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
        description="잠시 후 다시 시도하거나 홈에서 서비스 내용을 확인해 주세요."
        title="소개 콘텐츠를 불러오지 못했습니다"
        tone={state === "error" ? "error" : "empty"}
      />
    );
  }

  if (state === "permission" || state === "limited") {
    return (
      <StatusPanel
        action={
          <ButtonLink fullWidth href="/home" variant="outline">
            홈에서 둘러보기
          </ButtonLink>
        }
        description="이 기기에서는 일부 소개 콘텐츠만 이용할 수 있습니다. 홈에서 서비스 흐름을 계속 확인할 수 있습니다."
        title="소개 화면 이용이 제한되어 있습니다"
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
        <p>MCM RE:BORN</p>
      </header>

      {showContent ? (
        <>
          <section className={styles.introHero}>
            <p className={styles.eyebrow}>OFFICIAL UPCYCLING SERVICE</p>
            <h1>
              당신의 MCM에
              <br />새로운 여정을
            </h1>
            <p>
              사용하지 않는 MCM 제품을 분석하고, 나만의 디자인으로 다시
              만나는 공식 업사이클링 여정입니다.
            </p>
          </section>

          <a className={styles.introScrollCue} href="#intro-actions">
            <span>스크롤하고 시작하기</span>
            <i aria-hidden="true" />
          </a>

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
            AI 분석과 3D 목업은 제출한 사진을 바탕으로 만든 예상 결과입니다.
            결제와 주문 후 제품을 수거하며, MCM 공식 장인이 실물을 최종 점검한
            뒤 제작 조건이 달라지면 고객의 승인을 먼저 받습니다. 사진 사전 확인은
            공식 정품 판정을 대신하지 않습니다.
          </aside>
        </>
      ) : (
        <>
          <h1 className={styles.visuallyHidden}>MCM RE:BORN 서비스 소개</h1>
          <IntroUnavailable state={state} />
        </>
      )}

      <div className={styles.introActions} id="intro-actions">
        <ButtonLink fullWidth href="/login">
          시작하기
        </ButtonLink>
        <ButtonLink fullWidth href="/home" variant="outline">
          먼저 둘러보기
        </ButtonLink>
      </div>
    </AppShell>
  );
}
