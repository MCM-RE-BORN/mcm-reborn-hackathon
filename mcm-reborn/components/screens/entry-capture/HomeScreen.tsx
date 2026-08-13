import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { BottomNav } from "@/components/layout/BottomNav";
import { Section } from "@/components/layout/Section";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
          <ButtonLink fullWidth href="/" variant="outline">
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
            : "현재 기기에서는 진행 중인 여정 대신 서비스 소개와 정적 데모 화면을 이용할 수 있어요."
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

  return (
    <Card padding="regular" tone="surface">
      <Link className={styles.journeyCard} href="/submissions/demo">
        <div>
          <p className={styles.eyebrow}>진행 중인 여정</p>
          <h2>AI 분석이 완료되었어요</h2>
          <p>예상 재활용률과 추천 디자인을 확인해보세요.</p>
        </div>
        <Image
          alt=""
          aria-hidden="true"
          className={styles.journeyChevron}
          height={9}
          src="/assets/mvp-beta/icon-chevron-right.svg"
          width={17}
        />
      </Link>
    </Card>
  );
}

export function HomeScreen({ state }: HomeScreenProps) {
  return (
    <AppShell
      contentClassName={styles.homeContent}
      contentWidth="full"
      footer={<BottomNav active="home" />}
    >
      {/* TODO(asset): replace when the valid Figma hero raster is available */}
      <section className={styles.homeHero} aria-labelledby="home-hero-title">
        <Image
          alt=""
          aria-hidden="true"
          className={styles.homeHeroMask}
          fill
          priority
          sizes="(max-width: 402px) 100vw, 402px"
          src="/assets/mvp-beta/home-hero-mask.svg"
        />
        <div className={styles.homeHeroCopy}>
          <p>MCM RE:BORN</p>
          <h1 id="home-hero-title">
            오래된 MCM에
            <br />새로운 이야기를
          </h1>
          <p>
            AI 사전 분석부터 장인의 업사이클링까지,
            <br />당신의 제품을 위한 공식 여정을 시작하세요.
          </p>
          <ButtonLink href="/products/new" size="small" variant="secondary">
            업사이클링 신청
          </ButtonLink>
        </div>
      </section>

      <div className={styles.homeSections}>
        <Section
          description="등록한 제품과 제작 진행 상태를 빠르게 확인하세요."
          title="나의 RE:BORN"
        >
          <HomeStatus state={state} />
        </Section>

        <Section title="공식 서비스 안내">
          <div className={styles.serviceGrid}>
            <Card padding="compact" tone="outline">
              <p className={styles.serviceIndex}>01</p>
              <h3>제품 상태 분석</h3>
              <p>사진을 바탕으로 업사이클링 가능성을 미리 확인해요.</p>
            </Card>
            <Card padding="compact" tone="outline">
              <p className={styles.serviceIndex}>02</p>
              <h3>MCM 장인 제작</h3>
              <p>실물 검수 후 공식 장인이 선택한 디자인을 완성해요.</p>
            </Card>
          </div>
          <ButtonLink fullWidth href="/intro" variant="ghost">
            서비스 자세히 보기
          </ButtonLink>
        </Section>
      </div>
    </AppShell>
  );
}
