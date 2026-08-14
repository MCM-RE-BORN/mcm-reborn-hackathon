import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { TextField } from "@/components/ui/TextField";
import type { PageState } from "./page-state";
import styles from "./entry-capture.module.css";

type ProductCaptureScreenProps = {
  captured: boolean;
  state: PageState;
};

const CAPTURE_SLOTS = [
  { id: "front", label: "정면", className: "captureSlotHero" },
  { id: "side", label: "측면", className: "captureSlotHalf" },
  { id: "inside", label: "내부", className: "captureSlotHalf" },
  { id: "serial", label: "시리얼 번호", className: "captureSlotSerial" },
] as const;

function CaptureStatePanel({ state }: { state: PageState }) {
  if (state === "loading") {
    return (
      <StatusPanel
        description="선택한 사진의 형식과 용량을 확인하고 있어요."
        title="사진을 준비하는 중"
        tone="loading"
      />
    );
  }

  if (state === "empty") {
    return (
      <StatusPanel
        action={
          <ButtonLink fullWidth href="/products/new/camera" variant="outline">
            카메라 화면 열기
          </ButtonLink>
        }
        description="분석 요청에는 JPEG, PNG, WebP 사진이 1장 이상 필요해요."
        title="등록된 제품 사진이 없어요"
        tone="empty"
      />
    );
  }

  if (state === "error" || state === "limited") {
    return (
      <StatusPanel
        action={
          <ButtonLink fullWidth href="/products/new" variant="outline">
            사진 다시 확인하기
          </ButtonLink>
        }
        description={
          state === "limited"
            ? "사진은 1–4장, 파일당 최대 6MB의 JPEG, PNG, WebP만 등록할 수 있어요."
            : "사진을 읽지 못했어요. 파일 형식과 용량을 확인한 뒤 다시 시도해주세요."
        }
        title={state === "limited" ? "등록 가능한 범위를 넘었어요" : "사진을 등록하지 못했어요"}
        tone="error"
      />
    );
  }

  if (state === "permission") {
    return (
      <StatusPanel
        action={
          <ButtonLink fullWidth href="/products/new/camera" variant="outline">
            카메라 권한 안내 보기
          </ButtonLink>
        }
        description="기기 설정에서 브라우저의 카메라와 사진 접근을 허용해주세요."
        title="사진 접근 권한이 필요해요"
        tone="permission"
      />
    );
  }

  return null;
}

export function ProductCaptureScreen({ captured, state }: ProductCaptureScreenProps) {
  const showForm = state === "normal";

  return (
    <AppShell
      footer={
        showForm ? (
          <StickyActionBar>
            {/* TODO(post-beta): upload validated files and request the AI analysis endpoint. */}
            {captured ? (
              <ButtonLink fullWidth href="/submissions/demo?state=loading">
                AI 분석 요청하기
              </ButtonLink>
            ) : (
              <Button disabled fullWidth>
                사진 1장 이상 등록해 주세요
              </Button>
            )}
          </StickyActionBar>
        ) : undefined
      }
      header={
        <PageHeader
          backHref="/"
          description="분석할 MCM 제품의 모습을 선명하게 등록해주세요."
          title="제품 사진 등록"
        />
      }
    >
      <div className={styles.captureContent}>
        {showForm ? (
          <>
            <section aria-labelledby="capture-guide-title" className={styles.captureGuide}>
              <div className={styles.captureSectionHeading}>
                <div>
                  <h2 id="capture-guide-title">제품 사진</h2>
                  <p>정면, 측면, 내부, 시리얼 번호를 차례로 확인해주세요.</p>
                </div>
                <span>{captured ? "1" : "0"}/4</span>
              </div>

              <div className={styles.captureGrid}>
                {CAPTURE_SLOTS.map((slot, index) => {
                  const isCompleted = captured && index === 0;

                  return (
                    <Link
                      aria-label={`${slot.label} 사진 촬영 화면 열기`}
                      className={[
                        styles.captureSlot,
                        styles[slot.className],
                        isCompleted ? styles.captureSlotCompleted : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      href="/products/new/camera"
                      key={slot.id}
                    >
                      {isCompleted ? (
                        <Image
                          alt="예시 MCM 제품 정면 촬영본"
                          fill
                          sizes="(max-width: 360px) calc(100vw - 40px), (max-width: 402px) calc(100vw - 52px), 350px"
                          src="/assets/mvp-beta/camera-scene.png"
                        />
                      ) : slot.id === "serial" ? (
                        <Image
                          alt=""
                          aria-hidden="true"
                          className={styles.captureBarcode}
                          height={31}
                          src="/assets/mvp-beta/icon-barcode.svg"
                          width={50}
                        />
                      ) : (
                        <span aria-hidden="true" className={styles.captureAddMark}>
                          +
                        </span>
                      )}
                      <span className={styles.captureSlotLabel}>
                        {slot.label}
                        {isCompleted ? " · 예시" : ""}
                      </span>
                    </Link>
                  );
                })}
              </div>

              <p className={styles.captureRule}>
                JPEG, PNG, WebP · 1–4장 · 파일당 최대 6MB
              </p>
              <div className={styles.captureSecondaryAction}>
                {/* TODO(post-beta): open the native file picker and retain validated uploads. */}
                <Button aria-describedby="album-beta-note" disabled fullWidth variant="outline">
                  앨범에서 선택 · 베타 준비 중
                </Button>
                <p id="album-beta-note">
                  현재 베타에서는 카메라 진입과 상태 화면만 확인할 수 있어요.
                </p>
              </div>
            </section>

            <section aria-labelledby="product-info-title" className={styles.productInfo}>
              <div className={styles.captureSectionHeading}>
                <div>
                  <h2 id="product-info-title">제품 정보</h2>
                  <p>분석할 제품과 식별 정보를 확인해주세요.</p>
                </div>
              </div>
              <fieldset className={styles.productTypeGroup}>
                <legend>제품 유형</legend>
                <label>
                  <input defaultChecked name="product-type" type="radio" />
                  <span>가방</span>
                </label>
                <label>
                  <input name="product-type" type="radio" />
                  <span>지갑</span>
                </label>
                <label>
                  <input name="product-type" type="radio" />
                  <span>액세서리</span>
                </label>
              </fieldset>
              <TextField
                hint="제품 내부 라벨 또는 보증서의 번호를 입력해주세요."
                id="product-serial"
                label="시리얼 번호"
                placeholder="시리얼 번호 입력"
              />
              <TextField
                id="product-note"
                label="상태 메모"
                placeholder="오염이나 손상 부위를 알려주세요"
              />
            </section>
          </>
        ) : (
          <CaptureStatePanel state={state} />
        )}
      </div>
    </AppShell>
  );
}
