import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Section } from "@/components/layout/Section";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { ButtonLink } from "@/components/ui/Button";
import { DemoStatePanel } from "./DemoStatePanel";
import styles from "./analysis-design.module.css";
import type { DemoState } from "./types";

type MockupDetailScreenProps = {
  state: DemoState;
};

const GALLERY = [
  {
    alt: "Ottomar 여권 지갑 정면",
    image: "/assets/mvp-beta/passport-wallet-front.png",
  },
  {
    alt: "Ottomar 여권 지갑 내부",
    image: "/assets/mvp-beta/passport-wallet-open.png",
  },
  {
    alt: "Ottomar 여권 지갑 후면",
    image: "/assets/mvp-beta/passport-wallet-back.png",
  },
];

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
            디자인 신청하기
          </ButtonLink>
        </StickyActionBar>
      }
      header={<MockupHeader />}
    >
      <article className={styles.mockupContent}>
        <section
          aria-describedby="mockup-beta-note"
          aria-label="Ottomar 비세토스 여권 지갑 3D 목업 미리보기"
          className={styles.mockupHero}
        >
          <Image
            alt="Ottomar 비세토스 여권 지갑 정면 목업"
            fill
            priority
            sizes="(max-width: 360px) calc(100vw - 40px), (max-width: 402px) calc(100vw - 52px), 350px"
            src="/assets/mvp-beta/product-passport-wallet.png"
          />
          {/* TODO(post-beta): replace the static PNG entry with the contract-backed interactive GLB/glTF rotate and zoom viewer. */}
        </section>

        <header className={styles.productDetailHeader}>
          <h1>Ottomar 비세토스 여권 지갑</h1>
          <a className={styles.engravingLink} href="#engraving-note">
            각인 문구 추가하기
          </a>
        </header>

        <p className={styles.productDescription}>
          현대적 글로벌 노마드를 위해 제작된 이 클래식한 코냑 패스포트
          홀더는 뮌헨 하우스의 &apos;여행&apos;에 대한 정신을 보여줍니다. 내부는
          여행에 필요한 서류와 재정 관리를 위한 소지품을 효율적으로 수납할
          수 있는 부드러운 가죽으로 제작되었습니다.
        </p>

        <aside className={styles.contractNotice} id="mockup-beta-note">
          <strong>목업 이용 안내</strong>
          <p>
            현재 베타는 Figma의 정적 목업 이미지로 회전·확대 진입점을
            표현합니다. 소재와 장인 수작업 특성상 실제 결과는 목업과 다를 수
            있습니다.
          </p>
        </aside>

        <Section
          description="Figma에서 제공된 실제 제품 목업 이미지입니다."
          title="디테일 보기"
        >
          <ul className={styles.mockupGallery}>
            {GALLERY.map((item) => (
              <li className={styles.galleryItem} key={item.image}>
                <Image
                  alt={item.alt}
                  fill
                  sizes="(max-width: 360px) calc(100vw - 40px), (max-width: 402px) calc(100vw - 52px), 350px"
                  src={item.image}
                />
              </li>
            ))}
          </ul>
        </Section>

        <aside className={styles.engravingNotice} id="engraving-note">
          <strong>각인 옵션</strong>
          <p>각인 문구 편집과 옵션 저장은 정식 제품 단계에서 연결됩니다.</p>
          {/* TODO(post-beta): connect engraving option editing and persistence to the selected product configuration. */}
        </aside>
      </article>
    </AppShell>
  );
}
