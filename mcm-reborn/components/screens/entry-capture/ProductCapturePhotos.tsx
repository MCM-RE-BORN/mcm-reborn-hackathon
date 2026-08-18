"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";
import { DEMO_SCENARIO } from "@/data/demo-scenario";
import { CAPTURE_SLOTS, type CaptureSlotId } from "./capture-config";
import { useCaptureSession } from "./CaptureSessionProvider";
import styles from "./entry-capture.module.css";
import { normalizeSelectedImage } from "./image-processing";

type ProductCapturePhotosProps = {
  capturedSlots: CaptureSlotId[];
};

function albumFileName(slot: CaptureSlotId) {
  return `mcm-${slot}-${Date.now()}.jpg`;
}

export function ProductCapturePhotos({
  capturedSlots,
}: ProductCapturePhotosProps) {
  const { captures, setCapture } = useCaptureSession();
  const albumInputRef = useRef<HTMLInputElement>(null);
  const [albumMessage, setAlbumMessage] = useState<string>();
  const [isProcessing, setIsProcessing] = useState(false);
  const capturedSlotSet = new Set(capturedSlots);
  const completedSlotIds = CAPTURE_SLOTS.filter(
    (slot) => captures[slot.id] || capturedSlotSet.has(slot.id),
  ).map((slot) => slot.id);
  const completedCount = completedSlotIds.length;
  const nextAlbumSlot = CAPTURE_SLOTS.find(
    (slot) => !captures[slot.id] && !capturedSlotSet.has(slot.id),
  );
  const completedQuery = completedSlotIds.length
    ? `&completed=${completedSlotIds.join(",")}`
    : "";

  const handleAlbumSelection = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file || !nextAlbumSlot) {
      return;
    }

    setIsProcessing(true);
    setAlbumMessage(`${nextAlbumSlot.label} 사진을 준비하고 있어요.`);

    try {
      const blob = await normalizeSelectedImage(file);
      setCapture(
        nextAlbumSlot.id,
        blob,
        albumFileName(nextAlbumSlot.id),
      );
      setAlbumMessage(`${nextAlbumSlot.label} 사진을 등록했습니다.`);
    } catch (error) {
      setAlbumMessage(
        error instanceof Error
          ? error.message
          : "사진을 읽지 못했습니다. 다른 사진을 선택해주세요.",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <section aria-labelledby="capture-guide-title" className={styles.captureGuide}>
      <h2 className={styles.visuallyHidden} id="capture-guide-title">
        제품 사진 {completedCount}/{CAPTURE_SLOTS.length}
      </h2>
      <p className={styles.visuallyHidden}>
        정면, 측면, 내부, 각인을 차례로 확인해주세요.
      </p>

      <div className={styles.captureGrid}>
        {CAPTURE_SLOTS.map((slot) => {
          const sessionCapture = captures[slot.id];
          const isLegacyFallback =
            capturedSlotSet.has(slot.id) && !sessionCapture;
          const isCompleted = Boolean(sessionCapture || isLegacyFallback);

          return (
            <Link
              aria-label={`${slot.label} 사진 ${isCompleted ? "다시 " : ""}촬영`}
              className={[
                styles.captureSlot,
                styles[slot.className],
                isCompleted ? styles.captureSlotCompleted : "",
              ]
                .filter(Boolean)
                .join(" ")}
              href={`/products/new/camera?slot=${slot.id}${completedQuery}`}
              key={slot.id}
            >
              {sessionCapture ? (
                <Image
                  alt={`${slot.label} MCM 제품 촬영본`}
                  fill
                  sizes="(max-width: 360px) calc(100vw - 40px), (max-width: 402px) calc(100vw - 52px), 350px"
                  src={sessionCapture.previewUrl}
                  unoptimized
                />
              ) : isLegacyFallback ? (
                <Image
                  alt={`${slot.label} MCM 제품 예시 촬영본`}
                  fill
                  loading="eager"
                  sizes="(max-width: 360px) calc(100vw - 40px), (max-width: 402px) calc(100vw - 52px), 350px"
                  src={DEMO_SCENARIO.sourceProduct.images[slot.id]}
                />
              ) : slot.id === "engraving" ? (
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
                {sessionCapture
                  ? " · 변경"
                  : isLegacyFallback
                    ? " · 등록됨"
                    : ""}
              </span>
            </Link>
          );
        })}
      </div>

      <div className={styles.captureSecondaryAction}>
        <Button
          aria-describedby="album-selection-note"
          disabled={isProcessing || !nextAlbumSlot}
          fullWidth
          onClick={() => albumInputRef.current?.click()}
          variant="outline"
        >
          {isProcessing
            ? "사진 준비 중"
            : nextAlbumSlot
              ? `앨범에서 ${nextAlbumSlot.label} 선택`
              : "사진 4장 등록 완료"}
        </Button>
        <input
          accept="image/jpeg,image/png"
          hidden
          onChange={(event) => void handleAlbumSelection(event)}
          ref={albumInputRef}
          type="file"
        />
        <p
          aria-live="polite"
          className={albumMessage ? styles.captureAlbumMessage : undefined}
          id="album-selection-note"
        >
          {albumMessage ??
            "촬영본은 제품 등록을 마칠 때까지 브라우저에만 임시 보관됩니다."}
        </p>
      </div>
      <p className={styles.captureRule}>
        JPG, PNG · 최소 3장, 최대 4장 · 파일당 최대 10MB
      </p>
    </section>
  );
}
