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
import {
  CustomerApiError,
  customerFetch,
} from "@/components/screens/order-certificate/customer-client";
import {
  TEXTURE_PRIVACY_NOTICE_VERSION,
  type MeshyTaskKind,
  type MeshyTextureTaskResponse,
  type TextureJobKind,
  type TexturePreviewCreateResponse,
  type TextureProviderCapabilities,
} from "@/lib/texture-preview";
import { composeExteriorAtlas } from "./compose-exterior-atlas";
import {
  MockupViewer,
  type TextureApplicationState,
} from "./MockupViewer";
import styles from "./analysis-design.module.css";

const MESHY_POLL_INTERVAL_MS = 3_000;
const MAX_MESHY_POLLS = 80;
const MAX_TEXTURE_BYTES = 8 * 1024 * 1024;
const PASSPORT_WALLET_FRONT_IMAGE =
  "/assets/mvp-beta/passport-wallet-front.png";
const ALLOWED_TEXTURE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type TextureMockupStudioProps = {
  analysisId: string;
};

type PlanState = "fallback" | "idle" | "loading" | "ready";
type MeshyUiStatus =
  | "canceled"
  | "failed"
  | "idle"
  | "queued"
  | "running"
  | "succeeded";

type MeshyUiState = {
  error: string | null;
  progress: number;
  status: MeshyUiStatus;
  terminal: boolean;
};

const EMPTY_MESHY_STATE: MeshyUiState = {
  error: null,
  progress: 0,
  status: "idle",
  terminal: false,
};

export function TextureMockupStudio({ analysisId }: TextureMockupStudioProps) {
  const [applicationState, setApplicationState] =
    useState<TextureApplicationState>("idle");
  const [capabilities, setCapabilities] =
    useState<TextureProviderCapabilities | null>(null);
  const [capabilitiesUnavailable, setCapabilitiesUnavailable] = useState(false);
  const [externalError, setExternalError] = useState<string | null>(null);
  const [externalStatus, setExternalStatus] = useState<string | null>(null);
  const [planState, setPlanState] = useState<PlanState>("idle");
  const [sourceTask, setSourceTask] =
    useState<MeshyUiState>(EMPTY_MESHY_STATE);
  const [targetTask, setTargetTask] =
    useState<MeshyUiState>(EMPTY_MESHY_STATE);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [textureBlob, setTextureBlob] = useState<Blob | null>(null);
  const [textureEnabled, setTextureEnabled] = useState(true);
  const [modelReady, setModelReady] = useState(false);
  const [modelFailed, setModelFailed] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);
  const pipelineInFlightRef = useRef(false);
  const pollInFlightRef = useRef<Record<MeshyTaskKind, boolean>>({
    SOURCE_MODEL: false,
    TARGET_RETEXTURE: false,
  });
  const pollGenerationRef = useRef<Record<MeshyTaskKind, number>>({
    SOURCE_MODEL: 0,
    TARGET_RETEXTURE: 0,
  });

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
    const pollGenerations = pollGenerationRef.current;
    return () => {
      pollGenerations.SOURCE_MODEL += 1;
      pollGenerations.TARGET_RETEXTURE += 1;
    };
  }, []);

  const updateTask = useCallback(
    (jobKind: MeshyTaskKind, patch: Partial<MeshyUiState>) => {
      const update = (current: MeshyUiState) => ({ ...current, ...patch });
      if (jobKind === "SOURCE_MODEL") {
        setSourceTask(update);
      } else {
        setTargetTask(update);
      }
    },
    [],
  );

  const requestJob = useCallback(
    async (jobKind: TextureJobKind) =>
      customerFetch<TexturePreviewCreateResponse>(
        "/api/demo/texture-preview",
        {
          body: JSON.stringify({
            analysisId,
            externalAiProcessingConsentAccepted: true,
            jobKind,
            privacyNoticeVersion: TEXTURE_PRIVACY_NOTICE_VERSION,
          }),
          headers: {
            "Idempotency-Key": getTextureRequestKey(analysisId, jobKind),
          },
          method: "POST",
        },
      ),
    [analysisId],
  );

  const pollMeshyTask = useCallback(
    async (jobKind: MeshyTaskKind, taskToken: string) => {
      if (pollInFlightRef.current[jobKind]) return;

      pollInFlightRef.current[jobKind] = true;
      const generation = ++pollGenerationRef.current[jobKind];
      let providerTerminal = false;
      updateTask(jobKind, {
        error: null,
        status: "queued",
        terminal: false,
      });

      try {
        for (let attempt = 0; attempt < MAX_MESHY_POLLS; attempt += 1) {
          if (pollGenerationRef.current[jobKind] !== generation) return;
          if (attempt > 0) await delay(MESHY_POLL_INTERVAL_MS);
          if (pollGenerationRef.current[jobKind] !== generation) return;

          const task = await customerFetch<MeshyTextureTaskResponse>(
            "/api/demo/texture-preview",
            {
              body: JSON.stringify({ analysisId, taskToken }),
              method: "PUT",
            },
          );
          if (pollGenerationRef.current[jobKind] !== generation) return;
          if (task.jobKind !== jobKind) {
            throw new Error("외관 생성 작업 종류가 일치하지 않습니다.");
          }

          if (task.status === "succeeded") {
            if (jobKind === "SOURCE_MODEL") {
              updateTask(jobKind, {
                error: null,
                progress: 100,
                status: "succeeded",
                terminal: false,
              });
              return;
            }

            updateTask(jobKind, {
              error: null,
              progress: 98,
              status: "running",
              terminal: false,
            });
            setExternalStatus("외관 텍스처를 목업에 적용하고 있습니다.");
            const generatedAtlas = await downloadTextureBlob(
              analysisId,
              taskToken,
            );
            const composedAtlas = await composeExteriorAtlas(generatedAtlas);
            if (pollGenerationRef.current[jobKind] !== generation) return;

            setTextureBlob(composedAtlas);
            setTextureEnabled(true);
            updateTask(jobKind, {
              error: null,
              progress: 100,
              status: "succeeded",
              terminal: false,
            });
            setExternalError(null);
            setExternalStatus("외관 목업을 마무리하고 있습니다.");
            return;
          }

          updateTask(jobKind, {
            error: null,
            progress: task.progress,
            status: task.status,
            terminal: false,
          });
          if (jobKind === "TARGET_RETEXTURE") {
            setExternalStatus(meshyTaskStatusLabel(task));
          }

          if (task.status === "failed" || task.status === "canceled") {
            providerTerminal = true;
            throw new Error(
              task.errorMessage ?? "Meshy 작업을 완료하지 못했습니다.",
            );
          }
        }
        throw new Error(
          "외관 목업 생성이 계속 진행 중입니다. 잠시 후 다시 확인해 주세요.",
        );
      } catch (error) {
        if (pollGenerationRef.current[jobKind] !== generation) return;
        const taskTokenError = isMeshyTaskTokenError(error);
        if (taskTokenError) {
          providerTerminal = true;
          window.sessionStorage.removeItem(
            meshyTaskStorageKey(analysisId, jobKind),
          );
        }
        const message = readExternalError(error);
        updateTask(jobKind, {
          error: message,
          status: "failed",
          terminal: providerTerminal || taskTokenError,
        });
        if (jobKind === "TARGET_RETEXTURE") {
          setExternalError(message);
          setExternalStatus(null);
          setTextureEnabled(false);
        }
      } finally {
        pollInFlightRef.current[jobKind] = false;
      }
    },
    [analysisId, updateTask],
  );

  useEffect(() => {
    pollGenerationRef.current.SOURCE_MODEL += 1;
    pollGenerationRef.current.TARGET_RETEXTURE += 1;

    let active = true;
    const restoreTimer = window.setTimeout(() => {
      setPlanState("idle");
      setSourceTask(EMPTY_MESHY_STATE);
      setTargetTask(EMPTY_MESHY_STATE);
      setPipelineRunning(false);
      setTextureBlob(null);
      setTextureEnabled(true);
      setViewerReady(false);
      setExternalError(null);
      setExternalStatus(null);
      pipelineInFlightRef.current = false;
      pollInFlightRef.current.SOURCE_MODEL = false;
      pollInFlightRef.current.TARGET_RETEXTURE = false;

      const sourceToken = window.sessionStorage.getItem(
        meshyTaskStorageKey(analysisId, "SOURCE_MODEL"),
      );
      const targetToken = window.sessionStorage.getItem(
        meshyTaskStorageKey(analysisId, "TARGET_RETEXTURE"),
      );
      if (sourceToken) void pollMeshyTask("SOURCE_MODEL", sourceToken);
      if (targetToken) {
        setPipelineRunning(true);
        setExternalStatus("기존 외관 목업 작업을 확인하고 있습니다.");
        void pollMeshyTask("TARGET_RETEXTURE", targetToken).finally(() => {
          if (active) setPipelineRunning(false);
        });
      }
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(restoreTimer);
    };
  }, [analysisId, pollMeshyTask]);

  const startExteriorPipeline = useCallback(async () => {
    if (
      !capabilities?.features.targetRetexture ||
      pipelineInFlightRef.current ||
      targetTask.terminal
    ) {
      return;
    }

    pipelineInFlightRef.current = true;
    setPipelineRunning(true);
    setExternalError(null);

    try {
      const existingTargetToken = window.sessionStorage.getItem(
        meshyTaskStorageKey(analysisId, "TARGET_RETEXTURE"),
      );
      if (existingTargetToken) {
        setExternalStatus("기존 외관 목업 작업을 확인하고 있습니다.");
        await pollMeshyTask("TARGET_RETEXTURE", existingTargetToken);
        return;
      }

      setExternalStatus("외관 목업 생성을 준비하고 있습니다.");
      if (capabilities.features.exteriorPlan) {
        setPlanState("loading");
        try {
          const planResponse = await requestJob("EXTERIOR_PLAN");
          if (
            planResponse.kind !== "plan" ||
            planResponse.jobKind !== "EXTERIOR_PLAN"
          ) {
            throw new Error("외관 소재 분석 응답 형식이 올바르지 않습니다.");
          }
          setPlanState("ready");
        } catch (error) {
          if (isConsentGuardError(error)) throw error;
          setPlanState("fallback");
        }
      } else {
        setPlanState("fallback");
      }

      if (
        capabilities.features.sourceModel &&
        !sourceTask.terminal &&
        sourceTask.status !== "queued" &&
        sourceTask.status !== "running" &&
        sourceTask.status !== "succeeded"
      ) {
        try {
          const sourceResponse = await requestJob("SOURCE_MODEL");
          if (
            sourceResponse.kind !== "task" ||
            sourceResponse.jobKind !== "SOURCE_MODEL"
          ) {
            throw new Error("원제품 참고 3D 작업 응답 형식이 올바르지 않습니다.");
          }
          window.sessionStorage.setItem(
            meshyTaskStorageKey(analysisId, "SOURCE_MODEL"),
            sourceResponse.taskToken,
          );
          void pollMeshyTask("SOURCE_MODEL", sourceResponse.taskToken);
        } catch (error) {
          if (isConsentGuardError(error)) throw error;
          updateTask("SOURCE_MODEL", {
            error: readExternalError(error),
            status: "failed",
            terminal: true,
          });
        }
      }

      setExternalStatus("외관 목업을 생성하고 있습니다.");
      const targetResponse = await requestJob("TARGET_RETEXTURE");
      if (
        targetResponse.kind !== "task" ||
        targetResponse.jobKind !== "TARGET_RETEXTURE"
      ) {
        throw new Error("여권 지갑 텍스처 작업 응답 형식이 올바르지 않습니다.");
      }
      window.sessionStorage.setItem(
        meshyTaskStorageKey(analysisId, "TARGET_RETEXTURE"),
        targetResponse.taskToken,
      );
      await pollMeshyTask("TARGET_RETEXTURE", targetResponse.taskToken);
    } catch (error) {
      const message = readExternalError(error);
      setTargetTask((current) => ({
        ...current,
        error: message,
        status: "failed",
        // A create request may have reached the paid provider before its task
        // token reached this browser. Keep this attempt terminal so a second
        // click cannot create another paid job.
        terminal: true,
      }));
      setExternalError(message);
      setExternalStatus(null);
      setTextureEnabled(false);
    } finally {
      pipelineInFlightRef.current = false;
      setPipelineRunning(false);
    }
  }, [
    analysisId,
    capabilities,
    pollMeshyTask,
    requestJob,
    sourceTask.status,
    sourceTask.terminal,
    targetTask.terminal,
    updateTask,
  ]);

  const handleTextureStateChange = useCallback(
    (state: TextureApplicationState) => {
      setApplicationState(state);
      if (state === "applied") setViewerReady(true);
    },
    [],
  );

  const handleModelLoad = useCallback(() => {
    setModelReady(true);
    setModelFailed(false);
  }, []);

  const handleModelError = useCallback(() => {
    setModelReady(false);
    setModelFailed(true);
    setViewerReady(false);
    setApplicationState("error");
  }, []);

  const overallProgress = useMemo(() => {
    if (viewerReady) return 100;
    if (targetTask.status === "running" || targetTask.status === "queued") {
      return Math.min(98, 50 + Math.round(targetTask.progress * 0.48));
    }
    if (targetTask.status === "succeeded") return 99;
    if (planState === "ready" || planState === "fallback") return 40;
    if (planState === "loading") return 15;
    return pipelineRunning ? 5 : 0;
  }, [pipelineRunning, planState, targetTask, viewerReady]);

  const targetAvailable = Boolean(capabilities?.features.targetRetexture);
  const generationComplete = viewerReady && Boolean(textureBlob);
  const generationDisabled =
    !targetAvailable ||
    !modelReady ||
    modelFailed ||
    pipelineRunning ||
    targetTask.status === "queued" ||
    targetTask.status === "running" ||
    targetTask.terminal ||
    generationComplete;
  let generationButtonLabel = "외관 목업 생성";
  if (modelFailed) {
    generationButtonLabel = "3D 목업을 불러오지 못함";
  } else if (!modelReady) {
    generationButtonLabel = "3D 목업 준비 중";
  } else if (pipelineRunning) {
    generationButtonLabel = `외관 목업 생성 중 ${overallProgress}%`;
  } else if (generationComplete) {
    generationButtonLabel = "외관 목업 생성 완료";
  } else if (targetTask.terminal) {
    generationButtonLabel = "외관 목업 생성 실패";
  } else if (
    targetTask.status === "failed" ||
    (applicationState === "error" && textureBlob)
  ) {
    generationButtonLabel = "외관 목업 다시 확인";
  }

  const displayStatus = readDisplayStatus({
    applicationState,
    capabilities,
    capabilitiesUnavailable,
    externalStatus,
    generationComplete,
    pipelineRunning,
  });
  const displayError =
    (modelFailed
      ? "3D 목업을 불러오지 못했습니다. 페이지를 새로고침해 다시 시도해 주세요."
      : null) ??
    externalError ??
    (applicationState === "error" && textureBlob
      ? "외관 텍스처를 3D 목업에 적용하지 못했습니다."
      : null);
  const showProgress =
    !displayError && !generationComplete && overallProgress > 0;

  return (
    <div className={styles.textureStudio}>
      <div className={styles.mockupViewport}>
        <div
          aria-hidden={!viewerReady}
          className={styles.mockupViewerLayer}
          data-visible={viewerReady}
        >
          <MockupViewer
            key={analysisId}
            onModelError={handleModelError}
            onModelLoad={handleModelLoad}
            onTextureStateChange={handleTextureStateChange}
            textureBlob={textureEnabled ? (textureBlob ?? undefined) : undefined}
          />
        </div>

        {!viewerReady ? (
          <div className={styles.mockupPlaceholder}>
            <Image
              alt="RE:BORN 여권 지갑 제품 정면 이미지"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 640px"
              src={PASSPORT_WALLET_FRONT_IMAGE}
            />
            {showProgress ? (
              <div className={styles.mockupPlaceholderProgress}>
                <span>외관 목업 생성 중 {overallProgress}%</span>
                <div
                  aria-label={`외관 목업 생성 진행률 ${overallProgress}%`}
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={overallProgress}
                  className={styles.exteriorProgress}
                  role="progressbar"
                >
                  <span style={{ width: `${overallProgress}%` }} />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <section aria-label="외관 목업 생성" className={styles.texturePipeline}>
        <div className={styles.textureActions}>
          <Button
            disabled={generationDisabled}
            fullWidth
            onClick={() => void startExteriorPipeline()}
            size="medium"
            variant="secondary"
          >
            {generationButtonLabel}
          </Button>

          {generationComplete ? (
            <Button
              fullWidth
              onClick={() => setTextureEnabled((enabled) => !enabled)}
              size="medium"
              variant="outline"
            >
              {textureEnabled ? "기본 3D 모델과 비교" : "맞춤 외관 다시 적용"}
            </Button>
          ) : null}
        </div>

        {displayError ? (
          <p className={styles.textureError} role="alert">
            {displayError}
          </p>
        ) : (
          <p className={styles.textureStatus} role="status">
            {displayStatus}
          </p>
        )}
      </section>
    </div>
  );
}

async function downloadTextureBlob(analysisId: string, taskToken: string) {
  const asset = await customerFetch<{
    expiresAt: string;
    signedUrl: string;
  }>("/api/demo/texture-preview/asset", {
    body: JSON.stringify({ analysisId, taskToken }),
    method: "POST",
  });

  let response: Response;
  try {
    response = await fetch(asset.signedUrl, {
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
  } catch {
    throw new Error("보호된 텍스처 자산을 불러오지 못했습니다.");
  }
  if (!response.ok) {
    throw new Error("보호된 목표 UV 텍스처를 다운로드하지 못했습니다.");
  }
  const blob = await response.blob();
  if (
    !ALLOWED_TEXTURE_MIME_TYPES.has(blob.type) ||
    blob.size === 0 ||
    blob.size > MAX_TEXTURE_BYTES
  ) {
    throw new Error("AI가 반환한 목표 UV 텍스처 형식이 올바르지 않습니다.");
  }
  return blob;
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function meshyTaskStatusLabel(task: MeshyTextureTaskResponse) {
  if (task.status === "queued") return "외관 목업 생성 대기 중입니다.";
  if (task.status === "running") {
    return `외관 목업을 생성하고 있습니다. ${task.progress}%`;
  }
  if (task.status === "succeeded") return "외관 텍스처 생성이 완료됐습니다.";
  return task.errorMessage ?? "외관 목업을 생성하지 못했습니다.";
}

function isConsentGuardError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  const matchesConsentMessage =
    message.includes("consent") ||
    message.includes("active external ai analysis and texture notice") ||
    message.includes("동의");
  if (error instanceof CustomerApiError) {
    return error.status === 403 && matchesConsentMessage;
  }
  return matchesConsentMessage;
}

function isMeshyTaskTokenError(error: unknown) {
  if (
    !(error instanceof CustomerApiError) ||
    (error.status !== 400 && error.status !== 403)
  ) {
    return false;
  }
  const message = error.message.toLowerCase();
  return message.includes("texture task") || message.includes("texture asset");
}

function readExternalError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();
  if (isConsentGuardError(error)) {
    return "분석 시 외관 목업 생성 동의를 확인하지 못했습니다.";
  }
  if (isMeshyTaskTokenError(error)) {
    return "기존 외관 목업 작업의 복구 시간이 만료되었거나 작업을 인증할 수 없습니다.";
  }
  if (normalized.includes("credits")) {
    return "Meshy API credits가 부족합니다.";
  }
  if (normalized.includes("quota") || normalized.includes("rate limit")) {
    return "오늘 사용할 수 있는 외관 목업 생성 횟수를 초과했습니다.";
  }
  if (normalized.includes("not enabled")) {
    return "외관 목업 생성 기능이 활성화되지 않았습니다.";
  }
  return message || "외관 목업을 생성하지 못했습니다.";
}

function readDisplayStatus({
  applicationState,
  capabilities,
  capabilitiesUnavailable,
  externalStatus,
  generationComplete,
  pipelineRunning,
}: {
  applicationState: TextureApplicationState;
  capabilities: TextureProviderCapabilities | null;
  capabilitiesUnavailable: boolean;
  externalStatus: string | null;
  generationComplete: boolean;
  pipelineRunning: boolean;
}) {
  if (generationComplete) return "외관 목업 생성이 완료되었습니다.";
  if (applicationState === "loading") {
    return "외관 텍스처를 3D 목업에 적용하고 있습니다.";
  }
  if (externalStatus) return externalStatus;
  if (capabilitiesUnavailable) return "외관 목업을 준비할 수 없습니다.";
  if (!capabilities) return "외관 목업 생성 기능을 확인하고 있습니다.";
  if (!capabilities.features.targetRetexture) {
    return "외관 목업을 준비할 수 없습니다.";
  }
  if (pipelineRunning) return "외관 목업을 생성하고 있습니다.";
  return "외관 목업을 생성해 완성 모습을 확인해 보세요.";
}

function meshyTaskStorageKey(analysisId: string, jobKind: MeshyTaskKind) {
  return `mcm.reborn.texture.meshy-task.${analysisId}.${jobKind}`;
}

function textureRequestStorageKey(
  analysisId: string,
  jobKind: TextureJobKind,
) {
  return `mcm.reborn.texture.request.${analysisId}.${jobKind}.v1`;
}

function getTextureRequestKey(analysisId: string, jobKind: TextureJobKind) {
  const storageKey = textureRequestStorageKey(analysisId, jobKind);
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) return existing;

  const created = `texture-${jobKind.toLowerCase()}-${crypto.randomUUID()}`;
  window.sessionStorage.setItem(storageKey, created);
  return created;
}
