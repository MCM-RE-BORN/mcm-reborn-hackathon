"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/Button";
import { useCaptureSession } from "@/components/screens/entry-capture/CaptureSessionProvider";
import { customerFetch } from "@/components/screens/order-certificate/customer-client";
import {
  TEXTURE_PRIVACY_NOTICE_KO,
  TEXTURE_PRIVACY_NOTICE_VERSION,
  type ExternalTextureProvider,
  type MeshyTextureTaskResponse,
  type TexturePreviewCreateResponse,
  type TextureProviderCapabilities,
} from "@/lib/texture-preview";
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
const MESHY_POLL_INTERVAL_MS = 3_000;
const MAX_MESHY_POLLS = 80;

type TexturePreview = PreparedSourceTexture & {
  extractedUrl: string;
  preparedUrl: string;
};

type AiTexturePreview = {
  blob: Blob;
  url: string;
};

type TextureMockupStudioProps = {
  analysisId: string;
};

export function TextureMockupStudio({ analysisId }: TextureMockupStudioProps) {
  const { captures } = useCaptureSession();
  const sourceCapture = captures.rear ?? captures.front;
  const [preview, setPreview] = useState<TexturePreview | null>(null);
  const [preparationError, setPreparationError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(true);
  const [textureEnabled, setTextureEnabled] = useState(true);
  const [applicationState, setApplicationState] =
    useState<TextureApplicationState>("idle");
  const [capabilities, setCapabilities] =
    useState<TextureProviderCapabilities | null>(null);
  const [capabilitiesUnavailable, setCapabilitiesUnavailable] = useState(false);
  const [externalConsentAccepted, setExternalConsentAccepted] = useState(false);
  const [externalError, setExternalError] = useState<string | null>(null);
  const [externalStatus, setExternalStatus] = useState<string | null>(null);
  const [providerPending, setProviderPending] =
    useState<ExternalTextureProvider | null>(null);
  const [meshyProgress, setMeshyProgress] = useState(0);
  const [meshyTaskToken, setMeshyTaskToken] = useState<string | null>(null);
  const [meshyTerminal, setMeshyTerminal] = useState(false);
  const [meshyModelUrl, setMeshyModelUrl] = useState<string | null>(null);
  const [meshyModelReady, setMeshyModelReady] = useState(false);
  const [aiTexture, setAiTexture] = useState<AiTexturePreview | null>(null);
  const aiTextureUrlRef = useRef<string | null>(null);
  const pollGenerationRef = useRef(0);
  const providerInFlightRef = useRef(false);

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

  useEffect(() => {
    let active = true;
    customerFetch<TextureProviderCapabilities>("/api/demo/texture-preview")
      .then((value) => {
        if (active) setCapabilities(value);
      })
      .catch(() => {
        if (active) setCapabilitiesUnavailable(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      const storedTaskToken = window.sessionStorage.getItem(
        meshyTaskStorageKey(analysisId),
      );
      setMeshyTaskToken(storedTaskToken);
      if (storedTaskToken) {
        setExternalStatus(
          "이전에 시작한 Meshy 작업이 있습니다. 상태 확인을 눌러 이어서 확인하세요.",
        );
      }
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, [analysisId]);

  useEffect(() => {
    return () => {
      pollGenerationRef.current += 1;
      if (aiTextureUrlRef.current) {
        URL.revokeObjectURL(aiTextureUrlRef.current);
      }
    };
  }, []);

  const handleTextureStateChange = useCallback(
    (state: TextureApplicationState) => setApplicationState(state),
    [],
  );

  const replaceAiTexture = useCallback((blob: Blob) => {
    if (aiTextureUrlRef.current) {
      URL.revokeObjectURL(aiTextureUrlRef.current);
    }
    const url = URL.createObjectURL(blob);
    aiTextureUrlRef.current = url;
    setAiTexture({ blob, url });
  }, []);

  const pollMeshyTask = useCallback(
    async (taskToken: string, generation = ++pollGenerationRef.current) => {
      setProviderPending("MESHY");
      setExternalError(null);

      try {
        for (let attempt = 0; attempt < MAX_MESHY_POLLS; attempt += 1) {
          if (pollGenerationRef.current !== generation) return;
          if (attempt > 0) await delay(MESHY_POLL_INTERVAL_MS);

          const task = await customerFetch<MeshyTextureTaskResponse>(
            "/api/demo/texture-preview",
            {
              body: JSON.stringify({ analysisId, taskToken }),
              method: "PUT",
            },
          );
          if (pollGenerationRef.current !== generation) return;
          setMeshyProgress(task.progress);
          setExternalStatus(meshyTaskStatusLabel(task));

          if (task.status === "succeeded" && task.modelUrl) {
            setMeshyModelUrl(task.modelUrl);
            setMeshyModelReady(false);
            setTextureEnabled(false);
            setExternalStatus("Meshy 3D 리텍스처 목업을 불러오는 중입니다.");
            return;
          }
          if (task.status === "failed" || task.status === "canceled") {
            setMeshyTerminal(true);
            throw new Error(
              task.errorMessage ?? "Meshy 작업을 완료하지 못했습니다.",
            );
          }
        }
        throw new Error(
          "Meshy 작업이 계속 진행 중입니다. 잠시 후 상태를 다시 확인해 주세요.",
        );
      } catch (error) {
        if (pollGenerationRef.current !== generation) return;
        setExternalError(readExternalError(error));
      } finally {
        if (pollGenerationRef.current === generation) {
          setProviderPending(null);
        }
      }
    },
    [analysisId],
  );

  const createExternalTexture = useCallback(
    async (provider: ExternalTextureProvider) => {
      const styleBlob =
        provider === "MESHY"
          ? (aiTexture?.blob ?? preview?.prepared)
          : preview?.extracted;
      if (
        !styleBlob ||
        !sourceCapture ||
        !externalConsentAccepted ||
        providerInFlightRef.current ||
        (provider === "MESHY" && Boolean(meshyTaskToken))
      ) {
        return;
      }

      providerInFlightRef.current = true;
      const generation = ++pollGenerationRef.current;
      setProviderPending(provider);
      setExternalError(null);
      setExternalStatus(
        provider === "OPENAI"
          ? "OpenAI가 소재의 조명과 반복 경계를 보정하고 있습니다."
          : "Meshy 3D 리텍스처 작업을 시작하고 있습니다.",
      );
      if (provider === "MESHY") setMeshyProgress(0);

      try {
        const response = await customerFetch<TexturePreviewCreateResponse>(
          "/api/demo/texture-preview",
          {
            body: JSON.stringify({
              analysisId,
              externalAiProcessingConsentAccepted: true,
              privacyNoticeVersion: TEXTURE_PRIVACY_NOTICE_VERSION,
              provider,
              styleImageDataUrl: await blobToDataUrl(styleBlob),
            }),
            headers: {
              "Idempotency-Key": getTextureRequestKey(analysisId, provider),
            },
            method: "POST",
          },
        );

        if (response.kind === "texture") {
          const generatedBlob = await dataUrlToImageBlob(response.dataUrl);
          if (pollGenerationRef.current !== generation) return;
          replaceAiTexture(generatedBlob);
          setMeshyModelUrl(null);
          setTextureEnabled(true);
          setExternalStatus("OpenAI 보정 텍스처를 3D 목업에 적용했습니다.");
          return;
        }

        setMeshyTaskToken(response.taskToken);
        setMeshyTerminal(false);
        window.sessionStorage.setItem(
          meshyTaskStorageKey(analysisId),
          response.taskToken,
        );
        await pollMeshyTask(response.taskToken, generation);
      } catch (error) {
        if (pollGenerationRef.current !== generation) return;
        setExternalError(readExternalError(error));
        setExternalStatus(null);
      } finally {
        providerInFlightRef.current = false;
        if (pollGenerationRef.current === generation) {
          setProviderPending(null);
        }
      }
    },
    [
      aiTexture?.blob,
      analysisId,
      externalConsentAccepted,
      meshyTaskToken,
      pollMeshyTask,
      preview,
      replaceAiTexture,
      sourceCapture,
    ],
  );

  const resumeMeshyTask = useCallback(async () => {
    if (!meshyTaskToken || providerInFlightRef.current) return;
    providerInFlightRef.current = true;
    const generation = ++pollGenerationRef.current;
    try {
      await pollMeshyTask(meshyTaskToken, generation);
    } finally {
      providerInFlightRef.current = false;
    }
  }, [meshyTaskToken, pollMeshyTask]);

  const handleMeshyModelLoad = useCallback(() => {
    if (!meshyModelUrl) return;
    setMeshyModelReady(true);
    setExternalError(null);
    setExternalStatus("Meshy 3D 리텍스처 목업을 불러왔습니다.");
    setMeshyTaskToken(null);
  }, [meshyModelUrl]);

  const handleMeshyModelError = useCallback(() => {
    if (!meshyModelUrl) return;
    setMeshyModelReady(false);
    setMeshyModelUrl(null);
    setTextureEnabled(true);
    setExternalStatus(null);
    setExternalError(
      "Meshy GLB를 표시하지 못해 브라우저 로컬 텍스처 목업으로 복구했습니다. 작업 상태를 다시 확인할 수 있습니다.",
    );
  }, [meshyModelUrl]);

  const pipelineSteps = useMemo(
    () => [
      {
        detail: `원본 사진 중앙 ${preview?.sourceCropPercent ?? 62}% 소재 영역`,
        label: "텍스처 추출",
        state: preview ? "complete" : preparationError ? "error" : "active",
      },
      {
        detail: aiTexture
          ? "OpenAI가 조명과 반복 경계를 보정한 1024px 텍스처"
          : "1024px 미러 타일로 경계와 반복 패턴 정리",
        label: "목업용 텍스처 제작",
        state: preview ? "complete" : preparationError ? "waiting" : "active",
      },
      {
        detail:
          meshyModelUrl && meshyModelReady
            ? "Meshy가 생성한 리텍스처 GLB 표시"
            : meshyModelUrl
              ? "Meshy GLB 브라우저 로드 확인 중"
            : applicationState === "error"
            ? "원본 3D 모델로 복구됨"
            : textureEnabled
              ? "GLB UV에 실시간 적용"
              : "원본 모델 표시 중",
        label: "3D 목업 결합",
        state:
          (meshyModelUrl && meshyModelReady) ||
          (applicationState === "applied" && textureEnabled)
            ? "complete"
            : applicationState === "error"
              ? "error"
              : preview
                ? "active"
                : "waiting",
      },
    ],
    [
      aiTexture,
      applicationState,
      meshyModelUrl,
      meshyModelReady,
      preparationError,
      preview,
      textureEnabled,
    ],
  );

  return (
    <div className={styles.textureStudio}>
      <MockupViewer
        key={meshyModelUrl ?? "local-mockup"}
        modelSrc={meshyModelUrl ?? undefined}
        onModelError={handleMeshyModelError}
        onModelLoad={handleMeshyModelLoad}
        onTextureStateChange={handleTextureStateChange}
        textureBlob={
          !meshyModelUrl && textureEnabled
            ? (aiTexture?.blob ?? preview?.prepared)
            : undefined
        }
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
              {aiTexture ? (
                <figure>
                  <div className={styles.texturePreviewImage}>
                    <Image
                      alt="OpenAI가 조명과 반복 경계를 보정한 소재 텍스처"
                      fill
                      sizes="160px"
                      src={aiTexture.url}
                      unoptimized
                    />
                  </div>
                  <figcaption>OpenAI 보정 텍스처</figcaption>
                </figure>
              ) : null}
            </div>

            <Button
              fullWidth
              onClick={() => setTextureEnabled((enabled) => !enabled)}
              size="medium"
              variant="outline"
            >
              {textureEnabled ? "원본 3D 모델과 비교" : "맞춤 텍스처 다시 적용"}
            </Button>

            <section
              aria-labelledby="external-texture-title"
              className={styles.externalTextureControls}
            >
              <div>
                <span className={styles.textureEyebrow}>OPTIONAL AI UPGRADE</span>
                <h3 id="external-texture-title">외부 AI 품질 보정</h3>
                <p>
                  로컬 목업은 이미 동작합니다. 아래 기능은 키와 배포 설정이
                  준비된 경우에만 선택적으로 호출됩니다.
                </p>
              </div>

              {!capabilities && !capabilitiesUnavailable ? (
                <p className={styles.textureStatus} role="status">
                  AI 제공자 연결 상태를 확인하고 있습니다.
                </p>
              ) : null}

              {capabilitiesUnavailable ? (
                <p className={styles.textureError} role="status">
                  외부 AI 연결 상태를 확인하지 못했습니다. 로컬 텍스처 목업은
                  계속 사용할 수 있습니다.
                </p>
              ) : null}

              {capabilities?.enabled ? (
                <>
                  <label className={styles.externalTextureConsent}>
                    <input
                      checked={externalConsentAccepted}
                      disabled={!sourceCapture}
                      onChange={(event) =>
                        setExternalConsentAccepted(event.currentTarget.checked)
                      }
                      type="checkbox"
                    />
                    <span>
                      [필수] {TEXTURE_PRIVACY_NOTICE_KO}
                      <small>
                        처리 안내 버전 {capabilities.privacyNoticeVersion}
                      </small>
                    </span>
                  </label>

                  <div className={styles.externalTextureButtons}>
                    <Button
                      disabled={
                        !capabilities.providers.OPENAI ||
                        !sourceCapture ||
                        Boolean(aiTexture) ||
                        !externalConsentAccepted ||
                        Boolean(providerPending)
                      }
                      fullWidth
                      onClick={() => void createExternalTexture("OPENAI")}
                      size="medium"
                      variant="secondary"
                    >
                      {providerPending === "OPENAI"
                        ? "OpenAI 텍스처 생성 중..."
                        : aiTexture
                          ? "OpenAI 텍스처 보정 완료"
                        : "OpenAI 텍스처 보정"}
                    </Button>
                    <Button
                      disabled={
                        !capabilities.providers.MESHY ||
                        !sourceCapture ||
                        Boolean(meshyTaskToken) ||
                        Boolean(meshyModelUrl) ||
                        !externalConsentAccepted ||
                        Boolean(providerPending)
                      }
                      fullWidth
                      onClick={() => void createExternalTexture("MESHY")}
                      size="medium"
                      variant="secondary"
                    >
                      {providerPending === "MESHY"
                        ? `Meshy 처리 중 ${meshyProgress}%`
                        : "Meshy 3D 리텍스처"}
                    </Button>
                  </div>

                  {!sourceCapture ? (
                    <p className={styles.textureProviderHint}>
                      외부 AI 호출은 현재 분석에서 촬영한 원본이 남아 있을 때만
                      사용할 수 있습니다. 데모 원본은 브라우저 로컬 목업에만
                      사용합니다.
                    </p>
                  ) : null}

                  {!capabilities.providers.OPENAI ||
                  !capabilities.providers.MESHY ? (
                    <p className={styles.textureProviderHint}>
                      비활성 버튼은 해당 서버 API 키 또는 공개 목업 URL 설정이
                      필요합니다. Meshy 호출은 작업당 API credits를 사용합니다.
                    </p>
                  ) : (
                    <p className={styles.textureProviderHint}>
                      OpenAI는 이미지 생성 비용, Meshy는 2K 리텍스처 작업당 10
                      credits가 사용됩니다.
                    </p>
                  )}
                </>
              ) : null}

              {capabilities && !capabilities.enabled ? (
                <p className={styles.textureProviderHint}>
                  현재 배포는 외부 AI 호출이 꺼져 있어 브라우저 로컬 목업만
                  사용합니다.
                </p>
              ) : null}

              {externalStatus ? (
                <p className={styles.textureStatus} role="status">
                  {externalStatus}
                </p>
              ) : null}
              {externalError ? (
                <p className={styles.textureError} role="alert">
                  {externalError}
                </p>
              ) : null}
              {meshyTaskToken && !meshyTerminal && !providerPending ? (
                <Button
                  fullWidth
                  onClick={() => void resumeMeshyTask()}
                  size="small"
                  variant="ghost"
                >
                  Meshy 작업 상태 다시 확인
                </Button>
              ) : null}
            </section>
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

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("텍스처 이미지를 전송 형식으로 바꾸지 못했습니다."));
    };
    reader.onerror = () =>
      reject(new Error("텍스처 이미지를 읽지 못했습니다."));
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToImageBlob(dataUrl: string) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  if (blob.type !== "image/jpeg" || blob.size === 0 || blob.size > 5 * 1024 * 1024) {
    throw new Error("AI가 반환한 텍스처 이미지 형식이 올바르지 않습니다.");
  }
  return blob;
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function meshyTaskStatusLabel(task: MeshyTextureTaskResponse) {
  if (task.status === "queued") {
    return "Meshy 작업이 대기열에 있습니다.";
  }
  if (task.status === "running") {
    return `Meshy가 3D 목업을 리텍스처링하고 있습니다. ${task.progress}%`;
  }
  if (task.status === "succeeded") {
    return "Meshy 3D 리텍스처가 완료됐습니다.";
  }
  return task.errorMessage ?? "Meshy 3D 리텍스처를 완료하지 못했습니다.";
}

function readExternalError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.toLowerCase().includes("credits")) {
    return "Meshy API credits가 부족합니다. 계정 잔액을 확인해 주세요.";
  }
  if (message.toLowerCase().includes("not enabled")) {
    return "이 배포 환경에서 선택한 AI 제공자가 활성화되지 않았습니다.";
  }
  return message || "외부 AI 텍스처 처리에 실패했습니다.";
}

function meshyTaskStorageKey(analysisId: string) {
  return `mcm.reborn.texture.meshy-task.${analysisId}`;
}

function textureRequestStorageKey(
  analysisId: string,
  provider: ExternalTextureProvider,
) {
  return `mcm.reborn.texture.request.${analysisId}.${provider}`;
}

function getTextureRequestKey(
  analysisId: string,
  provider: ExternalTextureProvider,
) {
  const storageKey = textureRequestStorageKey(analysisId, provider);
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) return existing;

  const created = `texture-${crypto.randomUUID()}`;
  window.sessionStorage.setItem(storageKey, created);
  return created;
}
