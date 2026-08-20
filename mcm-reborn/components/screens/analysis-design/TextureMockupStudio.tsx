"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useCaptureSession } from "@/components/screens/entry-capture/CaptureSessionProvider";
import {
  MockupViewer,
  type TextureApplicationState,
} from "./MockupViewer";
import {
  prepareSourceTexture,
  type PreparedSourceTexture,
} from "./prepare-source-texture";
import styles from "./analysis-design.module.css";

const DEMO_SOURCE_IMAGE = "/assets/mvp-beta/source-backpack-front.webp";

type TexturePreview = PreparedSourceTexture & {
  extractedUrl: string;
  preparedUrl: string;
};

export function TextureMockupStudio() {
  const { captures } = useCaptureSession();
  const sourceCapture = captures.rear ?? captures.front;
  const [preview, setPreview] = useState<TexturePreview | null>(null);
  const [preparationError, setPreparationError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(true);
  const [textureEnabled, setTextureEnabled] = useState(true);
  const [applicationState, setApplicationState] =
    useState<TextureApplicationState>("idle");

  useEffect(() => {
    let active = true;
    const objectUrls: string[] = [];

    const prepare = async () => {
      try {
        const sourceBlob = sourceCapture?.blob ?? (await loadDemoSourceImage());
        const result = await prepareSourceTexture(sourceBlob);
        const extractedUrl = URL.createObjectURL(result.extracted);
        const preparedUrl = URL.createObjectURL(result.prepared);
        objectUrls.push(extractedUrl, preparedUrl);

        if (!active) {
          objectUrls.forEach((url) => URL.revokeObjectURL(url));
          objectUrls.length = 0;
          return;
        }
        setPreview({ ...result, extractedUrl, preparedUrl });
      } catch (error) {
        if (!active) return;
        setPreparationError(
          error instanceof Error
            ? error.message
            : "원제품 텍스처를 만들지 못했습니다.",
        );
      } finally {
        if (active) setPreparing(false);
      }
    };

    void prepare();

    return () => {
      active = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [sourceCapture?.blob]);

  const handleTextureStateChange = useCallback(
    (state: TextureApplicationState) => setApplicationState(state),
    [],
  );

  const pipelineSteps = useMemo(
    () => [
      {
        detail: `원본 사진 중앙 ${preview?.sourceCropPercent ?? 62}% 소재 영역`,
        label: "텍스처 추출",
        state: preview ? "complete" : preparationError ? "error" : "active",
      },
      {
        detail: "1024px 미러 타일로 경계와 반복 패턴 정리",
        label: "목업용 텍스처 제작",
        state: preview ? "complete" : preparationError ? "waiting" : "active",
      },
      {
        detail:
          applicationState === "error"
            ? "원본 3D 모델로 복구됨"
            : textureEnabled
              ? "GLB UV에 실시간 적용"
              : "원본 모델 표시 중",
        label: "3D 목업 결합",
        state:
          applicationState === "applied" && textureEnabled
            ? "complete"
            : applicationState === "error"
              ? "error"
              : preview
                ? "active"
                : "waiting",
      },
    ],
    [applicationState, preparationError, preview, textureEnabled],
  );

  return (
    <div className={styles.textureStudio}>
      <MockupViewer
        onTextureStateChange={handleTextureStateChange}
        textureBlob={textureEnabled ? preview?.prepared : undefined}
      />

      <section
        aria-labelledby="texture-pipeline-title"
        className={styles.texturePipeline}
      >
        <header className={styles.texturePipelineHeader}>
          <div>
            <span className={styles.textureEyebrow}>LIVE MOCKUP PIPELINE</span>
            <h2 id="texture-pipeline-title">원제품 텍스처 목업</h2>
          </div>
          <span className={styles.textureSourceBadge}>
            {sourceCapture ? "촬영 원본" : "데모 원본"}
          </span>
        </header>

        <ol className={styles.texturePipelineSteps}>
          {pipelineSteps.map((step, index) => (
            <li data-state={step.state} key={step.label}>
              <span aria-hidden="true" className={styles.textureStepNumber}>
                {index + 1}
              </span>
              <span>
                <strong>{step.label}</strong>
                <small>{step.detail}</small>
              </span>
            </li>
          ))}
        </ol>

        {preparing ? (
          <p aria-live="polite" className={styles.textureStatus}>
            원본 사진에서 소재 영역을 추출하고 있습니다.
          </p>
        ) : null}

        {preparationError ? (
          <p className={styles.textureError} role="alert">
            {preparationError} 3D 모델은 원본 텍스처로 표시합니다.
          </p>
        ) : null}

        {preview ? (
          <>
            <div className={styles.texturePreviewGrid}>
              <figure>
                <div className={styles.texturePreviewImage}>
                  <Image
                    alt="원제품 사진에서 추출한 소재 텍스처"
                    fill
                    sizes="160px"
                    src={preview.extractedUrl}
                    unoptimized
                  />
                </div>
                <figcaption>추출한 원본 소재</figcaption>
              </figure>
              <figure>
                <div className={styles.texturePreviewImage}>
                  <Image
                    alt="3D 목업 UV에 맞게 반복 경계를 정리한 텍스처"
                    fill
                    sizes="160px"
                    src={preview.preparedUrl}
                    unoptimized
                  />
                </div>
                <figcaption>목업용 반복 텍스처</figcaption>
              </figure>
            </div>

            <Button
              fullWidth
              onClick={() => setTextureEnabled((enabled) => !enabled)}
              size="medium"
              variant="outline"
            >
              {textureEnabled ? "원본 3D 모델과 비교" : "맞춤 텍스처 다시 적용"}
            </Button>
          </>
        ) : null}

        <p className={styles.textureDisclaimer}>
          브라우저에서 만든 예상 배치입니다. 단일 소재 목업의 전체 면에
          적용되며, 실제 재단 위치와 부자재 색상은 장인 실물 검수 후 달라질 수
          있습니다.
        </p>
      </section>
    </div>
  );
}

async function loadDemoSourceImage() {
  const response = await fetch(DEMO_SOURCE_IMAGE, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error("데모 원제품 사진을 불러오지 못했습니다.");
  }
  return response.blob();
}
