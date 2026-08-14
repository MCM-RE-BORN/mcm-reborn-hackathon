import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { ButtonLink } from "@/components/ui/Button";
import { StatusPanel } from "@/components/ui/StatusPanel";
import type { PageState } from "./page-state";
import styles from "./entry-capture.module.css";

type CameraScreenProps = {
  state: PageState;
};

function CameraState({ state }: CameraScreenProps) {
  if (state === "normal") {
    return null;
  }

  const isPermission = state === "permission";
  const isLoading = state === "loading";
  const isEmpty = state === "empty";
  const isLimited = state === "limited";

  return (
    <div className={styles.cameraState}>
      <StatusPanel
        action={
          <ButtonLink
            fullWidth
            href={isPermission ? "/products/new" : "/products/new/camera"}
            variant="outline"
          >
            {isPermission ? "제품 등록으로 돌아가기" : "다시 시도하기"}
          </ButtonLink>
        }
        description={
          isLoading
            ? "기기의 카메라 연결 상태를 확인하고 있어요."
            : isPermission
              ? "브라우저 설정에서 카메라 접근을 허용한 뒤 다시 시도해주세요."
              : isEmpty
                ? "사용 가능한 카메라를 찾지 못했어요. 앨범 등록은 정식 연동 후 제공됩니다."
                : isLimited
                  ? "현재 기기에서는 촬영 진입 UI만 확인할 수 있어요."
                  : "카메라 화면을 준비하지 못했어요. 잠시 후 다시 시도해주세요."
        }
        title={
          isLoading
            ? "카메라를 준비하는 중"
            : isPermission
              ? "카메라 권한이 필요해요"
              : isEmpty
                ? "사용 가능한 카메라가 없어요"
                : isLimited
                  ? "베타 촬영 범위가 제한되어 있어요"
                  : "카메라를 열지 못했어요"
        }
        tone={
          isLoading
            ? "loading"
            : isPermission
              ? "permission"
              : isEmpty
                ? "empty"
                : "error"
        }
      />
    </div>
  );
}

export function CameraScreen({ state }: CameraScreenProps) {
  const showCamera = state === "normal";

  return (
    <AppShell
      contentClassName={styles.cameraContent}
      contentWidth="full"
      immersive
    >
      <h1 className={styles.visuallyHidden}>제품 사진 촬영</h1>
      <Image
        alt="밝은 공간에 놓인 MCM 가방 촬영 예시"
        className={styles.cameraBackground}
        fill
        priority
        sizes="(max-width: 402px) 100vw, 402px"
        src="/assets/mvp-beta/camera-scene.png"
      />
      <div aria-hidden="true" className={styles.cameraScrim} />

      <Link
        aria-label="제품 사진 등록으로 돌아가기"
        className={styles.cameraBack}
        href="/products/new"
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

      {showCamera ? (
        <>
          <div className={styles.cameraGuideCopy}>
            <p>제품 정면을 가이드 안에 맞춰주세요</p>
            <span>밝은 곳에서 제품 전체가 보이도록 촬영해주세요.</span>
          </div>

          <div className={styles.cameraGuide} aria-hidden="true">
            <Image
              alt=""
              fill
              priority
              sizes="287px"
              src="/assets/mvp-beta/camera-detection-outline.svg"
            />
          </div>

          <div className={styles.cameraControls}>
            <span>정면</span>
            {/* TODO(post-beta): request Camera API permission and capture a real image. */}
            <Link
              aria-label="예시 사진 촬영"
              className={styles.cameraShutter}
              href="/products/new?captured=1"
            >
              <Image
                alt=""
                aria-hidden="true"
                fill
                sizes="66px"
                src="/assets/mvp-beta/camera-shutter-ring.svg"
              />
              <Image
                alt=""
                aria-hidden="true"
                fill
                sizes="52px"
                src="/assets/mvp-beta/camera-shutter-background.svg"
              />
            </Link>
            <span>1 / 4</span>
          </div>
        </>
      ) : (
        <CameraState state={state} />
      )}
    </AppShell>
  );
}
