import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { StatusPanel } from "@/components/ui/StatusPanel";
import type { CaptureSlotId } from "./capture-config";
import type { PageState } from "./page-state";
import { ProductCaptureAction } from "./ProductCaptureAction";
import { ProductCaptureDetails } from "./ProductCaptureDetails";
import { ProductCapturePhotos } from "./ProductCapturePhotos";
import styles from "./entry-capture.module.css";

type ProductCaptureScreenProps = {
  capturedSlots: CaptureSlotId[];
  state: PageState;
};

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
        description="분석 요청에는 정면, 후면, 상단, 하단, 좌측면, 우측면, 시리얼번호 JPG 또는 PNG 사진이 모두 필요해요."
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
            ? "정면, 후면, 상단, 하단, 좌측면, 우측면, 시리얼번호 사진을 각각 1장씩 등록해주세요. 파일당 최대 10MB의 JPG, PNG만 등록할 수 있어요."
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

export function ProductCaptureScreen({
  capturedSlots,
  state,
}: ProductCaptureScreenProps) {
  const showForm = state === "normal";

  return (
    <AppShell
      footer={
        showForm ? (
          <ProductCaptureAction
            capturedSlots={capturedSlots}
          />
        ) : undefined
      }
      header={
        <PageHeader
          backHref="/home"
          description="정면, 후면, 상단, 하단, 좌측면, 우측면, 시리얼번호 사진을 모두 선명하게 등록해주세요."
          title="제품 사진 등록"
        />
      }
    >
      <div className={styles.captureContent}>
        {showForm ? (
          <>
            <ProductCapturePhotos
              capturedSlots={capturedSlots}
            />

            <ProductCaptureDetails />
          </>
        ) : (
          <CaptureStatePanel state={state} />
        )}
      </div>
    </AppShell>
  );
}
