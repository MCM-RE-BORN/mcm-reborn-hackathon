"use client";

import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { Button, ButtonLink } from "@/components/ui/Button";
import {
  MIN_REQUIRED_CAPTURES,
  type CaptureSlotId,
} from "./capture-config";
import { captureCount } from "./capture-progress";
import { useCaptureSession } from "./CaptureSessionProvider";

type ProductCaptureActionProps = {
  capturedSlots: CaptureSlotId[];
};

export function ProductCaptureAction({
  capturedSlots,
}: ProductCaptureActionProps) {
  const { captures, productDetails } = useCaptureSession();
  const completedCount = captureCount(captures, capturedSlots);
  const remainingCount = Math.max(MIN_REQUIRED_CAPTURES - completedCount, 0);
  const hasRequiredDetails = Boolean(
    productDetails.category &&
      productDetails.purchaseYear.trim() &&
      productDetails.useDuration.trim() &&
      productDetails.desiredUse.trim(),
  );

  return (
    <StickyActionBar>
      {remainingCount === 0 && hasRequiredDetails ? (
        <ButtonLink fullWidth href="/submissions/demo?state=loading">
          AI 분석 접수하기
        </ButtonLink>
      ) : remainingCount === 0 ? (
        <Button disabled fullWidth>
          필수 제품 정보를 입력해 주세요
        </Button>
      ) : (
        <Button disabled fullWidth>
          사진을 {remainingCount}장 더 등록해 주세요
        </Button>
      )}
    </StickyActionBar>
  );
}
