import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { ButtonLink } from "@/components/ui/Button";
import { DEMO_SCENARIO } from "@/data/demo-scenario";
import { DemoStatePanel } from "./DemoStatePanel";
import { MockupViewer } from "./MockupViewer";
import styles from "./analysis-design.module.css";
import type { DemoState } from "./types";

type MockupDetailScreenProps = {
  state: DemoState;
};

function MockupHeader() {
  return (
    <header className={styles.mockupHeader}>
      <Link
        aria-label="추천 디자인으로 돌아가기"
        className={styles.mockupBackLink}
        href="/submissions/demo/designs"
      >
        <Image
          alt=""
          aria-hidden="true"
          height={13}
          loading="eager"
          src="/assets/mvp-beta/icon-back.svg"
          width={15}
        />
      </Link>
    </header>
  );
}

export function MockupDetailScreen({ state }: MockupDetailScreenProps) {
  if (state !== "normal") {
    return (
      <AppShell
        header={
          <PageHeader backHref="/submissions/demo/designs" title="3D 목업" />
        }
      >
        <div className={styles.statePage}>
          <DemoStatePanel
            actionHref={
              state === "limited"
                ? "/submissions/demo/ineligible"
                : "/submissions/demo/designs"
            }
            actionLabel={
              state === "limited" ? "제작 불가 결과 보기" : "추천 디자인으로 돌아가기"
            }
            context="mockup"
            state={state}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      footer={
        <StickyActionBar>
          <ButtonLink fullWidth href="/orders/new">
            이 디자인으로 주문 신청
          </ButtonLink>
        </StickyActionBar>
      }
      header={<MockupHeader />}
    >
      <article className={styles.mockupContent}>
        <MockupViewer />

        <header className={styles.productDetailHeader}>
          <h1>{DEMO_SCENARIO.selectedDesign.name}</h1>
          <a className={styles.engravingLink} href="#engraving-note">
            각인 옵션 안내
          </a>
        </header>

        <p className={styles.productDescription}>
          오래 함께한 모노그램 원단의 표정을 살려 새로운 여행을 위한
          여권지갑으로 제안합니다. 사진에서 확인한 상태가 좋은 전면 원단과
          측면 가죽을 중심으로 배치한 예상 디자인입니다.
        </p>

        <aside className={styles.contractNotice}>
          <strong>목업 이용 안내</strong>
          <p>
            이 목업은 사진 기반 예상 이미지입니다. 주문 후 장인이 실물을
            확인하면 패턴 위치·재단 범위·세부 마감이 달라질 수 있으며 변경
            조건은 제작 전에 고객에게 안내합니다.
          </p>
        </aside>

        <aside className={styles.engravingNotice} id="engraving-note">
          <strong>각인 옵션 안내</strong>
          <p>
            각인 서비스는 제품 상태와 제작 방식에 따라 제공 여부가 달라질 수
            있습니다. 실물 검수 후 가능한 위치와 크기를 안내합니다.
          </p>
        </aside>
      </article>
    </AppShell>
  );
}
