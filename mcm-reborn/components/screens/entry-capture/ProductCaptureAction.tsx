"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { StickyActionBar } from "@/components/layout/StickyActionBar";
import { Button } from "@/components/ui/Button";
import {
  CAPTURE_SLOTS,
  MIN_REQUIRED_CAPTURES,
  type CaptureSlotId,
} from "./capture-config";
import { captureCount } from "./capture-progress";
import {
  DESIRED_USE_OPTIONS,
  USE_DURATION_OPTIONS,
  useCaptureSession,
} from "./CaptureSessionProvider";
import { customerFetch } from "../order-certificate/customer-client";

type ProductCaptureActionProps = {
  capturedSlots: CaptureSlotId[];
};

export function ProductCaptureAction({
  capturedSlots,
}: ProductCaptureActionProps) {
  const router = useRouter();
  const { captures, productDetails } = useCaptureSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const completedCount = captureCount(captures, capturedSlots);
  const remainingCount = Math.max(MIN_REQUIRED_CAPTURES - completedCount, 0);
  const normalizedUseDuration =
    productDetails.useDuration.trim() || USE_DURATION_OPTIONS[0];
  const normalizedDesiredUse =
    productDetails.desiredUse.trim() || DESIRED_USE_OPTIONS[0];
  const hasRequiredDetails = Boolean(
    productDetails.category &&
      productDetails.purchaseYear.trim() &&
      normalizedUseDuration &&
      normalizedDesiredUse,
  );

  async function submitAnalysis() {
    if (remainingCount !== 0 || !hasRequiredDetails || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const orderedCaptures = CAPTURE_SLOTS.map((slot) => captures[slot.id]);
      if (orderedCaptures.some((capture) => !capture)) {
        throw new Error("필수 사진 7장을 모두 등록해 주세요.");
      }

      const presignedAssets: Array<{ assetId: string; headers: Record<string, string>; uploadUrl: string }> = [];
      for (let index = 0; index < orderedCaptures.length; index += 4) {
        const chunk = orderedCaptures.slice(index, index + 4);
        const presigned = await customerFetch<{
          assets: Array<{ assetId: string; headers: Record<string, string>; uploadUrl: string }>;
        }>("/api/v2/uploads/presign", {
          body: JSON.stringify({
            files: chunk.map((capture, chunkIndex) => ({
              contentType: capture!.blob.type === "image/png" ? "image/png" : "image/jpeg",
              fileName: capture!.fileName,
              purpose: purposeForSlot(CAPTURE_SLOTS[index + chunkIndex].id),
              sizeBytes: capture!.blob.size,
            })),
          }),
          method: "POST",
        });
        presignedAssets.push(...presigned.assets);
        await Promise.all(
          presigned.assets.map((asset, assetIndex) => {
            const capture = chunk[assetIndex]!;
            return fetch(asset.uploadUrl, {
              body: capture.blob,
              headers: asset.headers,
              method: "PUT",
            }).then((response) => {
              if (!response.ok) {
                throw new Error("사진 업로드에 실패했습니다.");
              }
            });
          }),
        );
      }

      const analysis = await customerFetch<{ id: string }>("/api/v2/analyses", {
        body: JSON.stringify({
          category: productDetails.category,
          conditionNote: productDetails.conditionNote || undefined,
          desiredUse: normalizedDesiredUse,
          imageAssetIds: presignedAssets.map((asset) => asset.assetId),
          locale: "ko-KR",
          purchaseYear: Number(productDetails.purchaseYear),
          serialNumber: productDetails.serialNumber || undefined,
          useDuration: normalizedUseDuration,
        }),
        method: "POST",
      });
      router.replace(`/submissions/demo/analysis?analysisId=${analysis.id}`);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "사진 분석 접수에 실패했습니다.",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <StickyActionBar>
      {remainingCount === 0 && hasRequiredDetails ? (
        <Button fullWidth disabled={isSubmitting} onClick={() => void submitAnalysis()}>
          {isSubmitting ? "AI 분석 접수 중..." : "AI 분석 접수하기"}
        </Button>
      ) : remainingCount === 0 ? (
        <Button disabled fullWidth>
          필수 제품 정보를 입력해 주세요
        </Button>
      ) : (
        <Button disabled fullWidth>
          사진을 {remainingCount}장 더 등록해 주세요
        </Button>
      )}
      {submitError ? <small role="alert">{submitError}</small> : null}
    </StickyActionBar>
  );
}

function purposeForSlot(slot: CaptureSlotId) {
  if (slot === "serialNumber") {
    return "ENGRAVING" as const;
  }
  if (slot === "top" || slot === "bottom" || slot === "leftSide" || slot === "rightSide") {
    return "SOURCE_SIDE" as const;
  }
  return "SOURCE_FRONT" as const;
}
