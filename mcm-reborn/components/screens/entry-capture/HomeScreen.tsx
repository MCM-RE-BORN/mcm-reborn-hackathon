import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { ActionButtonLink } from "@/components/ui/ActionButtonLink";
import { ButtonLink } from "@/components/ui/Button";
import { StatusPanel } from "@/components/ui/StatusPanel";
import type { PageState } from "./page-state";
import styles from "./entry-capture.module.css";

type HomeScreenProps = {
  state: PageState;
};

function HomeStatus({ state }: HomeScreenProps) {
  if (state === "loading") {
    return (
      <StatusPanel
        description="접수와 제작 진행 상태를 확인하고 있어요."
        title="내 여정을 불러오는 중"
        tone="loading"
      />
    );
  }

  if (state === "empty") {
    return (
      <StatusPanel
        action={
          <ButtonLink fullWidth href="/products/new" variant="outline">
            첫 제품 등록하기
          </ButtonLink>
        }
        description="제품 사진을 등록하면 분석부터 제작까지 한곳에서 확인할 수 있어요."
        title="진행 중인 여정이 없어요"
        tone="empty"
      />
    );
  }

  if (state === "error") {
    return (
      <StatusPanel
        action={
          <ButtonLink fullWidth href="/home" variant="outline">
            다시 불러오기
          </ButtonLink>
        }
        description="잠시 후 다시 시도해주세요. 제품 등록은 계속 시작할 수 있어요."
        title="진행 상태를 불러오지 못했어요"
        tone="error"
      />
    );
  }

  if (state === "permission" || state === "limited") {
    const isPermission = state === "permission";

    return (
      <StatusPanel
        action={
          <ButtonLink
            fullWidth
            href={isPermission ? "/login" : "/intro"}
            variant="outline"
          >
            {isPermission ? "로그인하기" : "서비스 안내 보기"}
          </ButtonLink>
        }
        description={
          isPermission
            ? "내 접수 내역은 로그인 후 확인할 수 있어요."
            : "현재 기기에서는 진행 중인 여정 대신 서비스 소개 화면을 이용할 수 있어요."
        }
        title={
          isPermission
            ? "로그인이 필요한 정보예요"
            : "이 기기에서는 일부 기능이 제한되어 있어요"
        }
        tone="permission"
      />
    );
  }

  return null;
}

export function HomeScreen({ state }: HomeScreenProps) {
  return (
    <AppShell
      contentClassName={styles.homeContent}
      contentWidth="full"
      footer={<BottomNav active="home" />}
    >
      <section className={styles.homeHero} aria-hidden="true">
        <span className={styles.homeHeroMask} />
        <span className={styles.homeHeroMedia}>
          <video
            autoPlay
            className={styles.homeHeroVideo}
            loop
            muted
            playsInline
            preload="metadata"
          >
            <source
              src="/assets/mvp-beta/home-hero-video.mp4"
              type="video/mp4"
            />
          </video>
        </span>
      </section>

      <section className={styles.homeIntro} aria-labelledby="home-hero-title">
        <h1 id="home-hero-title">Not the End, RE:BORN</h1>
        <p className={styles.homeTagline}>
          장인의 손끝에서, 두 번째 여정이 시작되다
        </p>
        <p className={styles.homeDescription}>
          AI가 업사이클링 가능성을 진단하고
          <br />
          장인이 완성하는 맞춤 리폼
        </p>
        <ActionButtonLink
          className={styles.homePrimaryAction}
          fullWidth
          href="/products/new"
        >
          상품 진단하기
        </ActionButtonLink>
      </section>

      {state !== "normal" ? (
        <div className={styles.homeState}>
          <HomeStatus state={state} />
        </div>
      ) : null}
    </AppShell>
  );
}
