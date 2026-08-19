"use client";

import Image from "next/image";
import { CAPTURE_SLOTS } from "@/components/screens/entry-capture/capture-config";
import { useCaptureSession } from "@/components/screens/entry-capture/CaptureSessionProvider";
import styles from "./analysis-design.module.css";

export function SubmissionProductSummary() {
  const { captures, productDetails } = useCaptureSession();
  const primaryCaptureSlot = CAPTURE_SLOTS.find((slot) => captures[slot.id]);
  const primaryCapture = primaryCaptureSlot
    ? captures[primaryCaptureSlot.id]
    : undefined;
  const imageSource = primaryCapture?.previewUrl;
  const imageAlt = primaryCaptureSlot
    ? `등록한 ${primaryCaptureSlot.label} 제품 사진`
    : "등록한 제품 사진 없음";

  return (
    <section
      aria-labelledby="submitted-product-title"
      className={styles.sourceSummary}
    >
      <div className={styles.sourceThumbnail}>
        {imageSource ? (
          <Image
            alt={imageAlt}
            fill
            sizes="72px"
            src={imageSource}
            unoptimized
          />
        ) : (
          <span aria-hidden="true" className={styles.sourceThumbnailPlaceholder}>
            사진 없음
          </span>
        )}
      </div>
      <div className={styles.sourceSummaryCopy}>
        <span>등록한 원제품</span>
        <h2 id="submitted-product-title">
          {productDetails.category || "등록한 제품"}
        </h2>
        <p>
          {productDetails.purchaseYear}년 구매 · {productDetails.useDuration} 사용
        </p>
        <p>희망 제품 · RE:BORN {productDetails.desiredUse}</p>
      </div>
    </section>
  );
}
