"use client";

import Image from "next/image";
import { CAPTURE_SLOTS } from "@/components/screens/entry-capture/capture-config";
import { useCaptureSession } from "@/components/screens/entry-capture/CaptureSessionProvider";
import { DEMO_SCENARIO } from "@/data/demo-scenario";
import styles from "./analysis-design.module.css";

export function SubmissionProductSummary() {
  const { captures, productDetails } = useCaptureSession();
  const primaryCaptureSlot = CAPTURE_SLOTS.find((slot) => captures[slot.id]);
  const primaryCapture = primaryCaptureSlot
    ? captures[primaryCaptureSlot.id]
    : undefined;
  const imageSource =
    primaryCapture?.previewUrl ?? DEMO_SCENARIO.sourceProduct.image;
  const imageAlt = primaryCaptureSlot
    ? `등록한 ${primaryCaptureSlot.label} 제품 사진`
    : `${DEMO_SCENARIO.sourceProduct.name} 예시 사진`;

  return (
    <section
      aria-labelledby="submitted-product-title"
      className={styles.sourceSummary}
    >
      <div className={styles.sourceThumbnail}>
        <Image
          alt={imageAlt}
          fill
          sizes="72px"
          src={imageSource}
          unoptimized={Boolean(primaryCapture)}
        />
      </div>
      <div className={styles.sourceSummaryCopy}>
        <span>등록한 원제품</span>
        <h2 id="submitted-product-title">
          {primaryCapture ? "MCM 가방" : DEMO_SCENARIO.sourceProduct.name}
        </h2>
        <p>
          {productDetails.purchaseYear}년 구매 · {productDetails.useDuration} 사용
        </p>
        <p>희망 제품 · RE:BORN {productDetails.desiredUse}</p>
      </div>
    </section>
  );
}
