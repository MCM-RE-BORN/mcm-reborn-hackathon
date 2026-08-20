"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/Button";
import { customerFetch } from "@/components/screens/order-certificate/customer-client";
import {
  TEXTURE_PRIVACY_NOTICE_KO,
  TEXTURE_PRIVACY_NOTICE_VERSION,
  type ExteriorMaterialPart,
  type ExteriorMaterialPlan,
  type ExteriorPart,
  type ExteriorView,
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
const ALLOWED_TEXTURE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const EXTERIOR_VIEWS: Array<{
  id: ExteriorView;
  koreanLabel: string;
  shortLabel: string;
}> = [
  { id: "FRONT", koreanLabel: "정면", shortLabel: "FRONT" },
  { id: "RIGHT", koreanLabel: "우측면", shortLabel: "RIGHT" },
  { id: "REAR", koreanLabel: "후면", shortLabel: "REAR" },
  { id: "LEFT", koreanLabel: "좌측면", shortLabel: "LEFT" },
];

const EXTERIOR_PARTS: Array<{
  description: string;
  id: ExteriorPart;
  label: string;
}> = [
  {
    description: "여권 지갑 외관의 주 소재 후보",
    id: "BODY",
    label: "가방 본체",
  },
  {
    description: "테두리와 보강 가죽 후보",
    id: "TRIM",
    label: "가죽 트리밍",
  },
  {
    description: "원제품에서만 확인하며 이번 디자인에는 적용하지 않음",
    id: "STRAP",
    label: "스트랩",
  },
  {
    description: "목표 모델의 검수된 금속 PBR 소재를 유지",
    id: "HARDWARE",
    label: "금속 부자재",
  },
];

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
  const [externalConsentAccepted, setExternalConsentAccepted] = useState(false);
  const [externalError, setExternalError] = useState<string | null>(null);
  const [externalStatus, setExternalStatus] = useState<string | null>(null);
  const [exteriorPlan, setExteriorPlan] =
    useState<ExteriorMaterialPlan | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planState, setPlanState] = useState<PlanState>("idle");
  const [sourceTask, setSourceTask] =
    useState<MeshyUiState>(EMPTY_MESHY_STATE);
  const [targetTask, setTargetTask] =
    useState<MeshyUiState>(EMPTY_MESHY_STATE);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [textureBlob, setTextureBlob] = useState<Blob | null>(null);
  const [textureEnabled, setTextureEnabled] = useState(true);
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
            setExternalStatus(
              "생성된 텍스처를 검수된 여권 지갑 외관 소재 맵에 합성하고 있습니다.",
            );
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
            setExternalStatus(
              "외관 텍스처를 여권 지갑 소재 맵에 합성했습니다.",
            );
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
          "Meshy 작업이 계속 진행 중입니다. 외관 목업 생성을 다시 눌러 상태를 확인해 주세요.",
        );
      } catch (error) {
        if (pollGenerationRef.current[jobKind] !== generation) return;
        const message = readExternalError(error);
        updateTask(jobKind, {
          error: message,
          status: "failed",
          terminal: providerTerminal,
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

    const restoreTimer = window.setTimeout(() => {
      setExteriorPlan(null);
      setPlanError(null);
      setPlanState("idle");
      setSourceTask(EMPTY_MESHY_STATE);
      setTargetTask(EMPTY_MESHY_STATE);
      setTextureBlob(null);
      setTextureEnabled(true);
      setExternalError(null);
      setExternalStatus(null);

      const sourceToken = window.sessionStorage.getItem(
        meshyTaskStorageKey(analysisId, "SOURCE_MODEL"),
      );
      const targetToken = window.sessionStorage.getItem(
        meshyTaskStorageKey(analysisId, "TARGET_RETEXTURE"),
      );
      if (sourceToken) void pollMeshyTask("SOURCE_MODEL", sourceToken);
      if (targetToken) {
        setPipelineRunning(true);
        setExternalStatus(
          "이전에 시작한 여권 지갑 외관 텍스처 작업을 이어서 확인하고 있습니다.",
        );
        void pollMeshyTask("TARGET_RETEXTURE", targetToken).finally(() => {
          setPipelineRunning(false);
        });
      }
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, [analysisId, pollMeshyTask]);

  const startExteriorPipeline = useCallback(async () => {
    if (
      !capabilities?.features.targetRetexture ||
      !externalConsentAccepted ||
      pipelineInFlightRef.current
    ) {
      return;
    }

    pipelineInFlightRef.current = true;
    setPipelineRunning(true);
    setExternalError(null);
    setExternalStatus("등록된 외관 4면을 확인하고 있습니다.");

    try {
      if (capabilities.features.exteriorPlan) {
        setPlanState("loading");
        setPlanError(null);
        try {
          const planResponse = await requestJob("EXTERIOR_PLAN");
          if (
            planResponse.kind !== "plan" ||
            planResponse.jobKind !== "EXTERIOR_PLAN"
          ) {
            throw new Error("외관 소재 분석 응답 형식이 올바르지 않습니다.");
          }
          setExteriorPlan(planResponse.plan);
          setPlanState("ready");
        } catch (error) {
          setExteriorPlan(null);
          setPlanError(readExternalError(error));
          setPlanState("fallback");
        }
      } else {
        setExteriorPlan(null);
        setPlanError(null);
        setPlanState("fallback");
      }

      if (
        capabilities.features.sourceModel &&
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
          updateTask("SOURCE_MODEL", {
            error: readExternalError(error),
            status: "failed",
            terminal: true,
          });
        }
      }

      setExternalStatus(
        "Meshy가 여권 지갑 외관용 목표 UV 텍스처를 생성하고 있습니다.",
      );
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
        // A create request can fail after Meshy accepted a paid job but before
        // its task id reached this browser. The server deliberately seals that
        // reservation to prevent an accidental second charge.
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
    externalConsentAccepted,
    pollMeshyTask,
    requestJob,
    sourceTask.status,
    updateTask,
  ]);

  const handleTextureStateChange = useCallback(
    (state: TextureApplicationState) => setApplicationState(state),
    [],
  );

  const pipelineSteps = useMemo(
    () => [
      {
        detail: "정면 · 우측면 · 후면 · 좌측면의 서버 저장 원본",
        label: "외관 4면 준비",
        state: "complete",
      },
      {
        detail:
          planState === "ready"
            ? "BODY · TRIM · STRAP · HARDWARE 외관 소재 후보 분류 완료"
            : planState === "loading"
              ? "외관에서 확인되는 소재 후보를 분류하는 중"
              : planState === "fallback"
                ? "AI 분류 없이 보수적인 기본 소재 규칙 사용"
                : "생성 시작 후 외관 소재 후보를 분류",
        label: "외관 소재 분류",
        state:
          planState === "ready"
            ? "complete"
            : planState === "loading"
              ? "active"
              : planState === "fallback"
                ? "skipped"
                : "waiting",
      },
      {
        detail: sourceModelStepDetail(capabilities, sourceTask),
        label: "참고용 원제품 3D",
        state: sourceModelStepState(capabilities, sourceTask),
      },
      {
        detail: targetTextureStepDetail(targetTask),
        label: "목표 UV 텍스처 생성",
        state: targetTextureStepState(targetTask),
      },
      {
        detail:
          applicationState === "applied" && textureEnabled
            ? "검수된 외관 마스크 범위에만 텍스처 적용 완료"
            : applicationState === "error"
              ? "기본 여권 지갑 모델로 복구됨"
              : textureBlob
                ? "여권 지갑 외관 소재 맵을 적용하는 중"
                : "기본 여권 지갑 모델 표시 중",
        label: "여권 지갑 외관 결합",
        state:
          applicationState === "applied" && textureEnabled
            ? "complete"
            : applicationState === "error"
              ? "error"
              : textureBlob
                ? "active"
                : "waiting",
      },
    ],
    [
      applicationState,
      capabilities,
      planState,
      sourceTask,
      targetTask,
      textureBlob,
      textureEnabled,
    ],
  );

  const overallProgress = useMemo(() => {
    if (applicationState === "applied") return 100;
    if (targetTask.status === "running" || targetTask.status === "queued") {
      return Math.min(98, 50 + Math.round(targetTask.progress * 0.48));
    }
    if (targetTask.status === "succeeded") return 99;
    if (planState === "ready" || planState === "fallback") return 40;
    if (planState === "loading") return 15;
    return pipelineRunning ? 5 : 0;
  }, [applicationState, pipelineRunning, planState, targetTask]);

  const targetAvailable = Boolean(capabilities?.features.targetRetexture);
  const generationComplete =
    targetTask.status === "succeeded" && applicationState !== "error";
  const generationDisabled =
    !targetAvailable ||
    !externalConsentAccepted ||
    pipelineRunning ||
    targetTask.status === "queued" ||
    targetTask.status === "running" ||
    targetTask.terminal ||
    generationComplete;
  let generationButtonLabel = "외관 목업 생성";
  if (pipelineRunning) {
    generationButtonLabel = `외관 목업 생성 중 ${overallProgress}%`;
  } else if (generationComplete) {
    generationButtonLabel = "외관 목업 생성 완료";
  } else if (targetTask.terminal) {
    generationButtonLabel = "외관 목업 생성 실패";
  } else if (targetTask.status === "failed") {
    generationButtonLabel = "외관 목업 다시 시도";
  }

  return (
    <div className={styles.textureStudio}>
      <MockupViewer
        onTextureStateChange={handleTextureStateChange}
        textureBlob={textureEnabled ? (textureBlob ?? undefined) : undefined}
      />

      <section
        aria-labelledby="texture-pipeline-title"
        className={styles.texturePipeline}
      >
        <header className={styles.texturePipelineHeader}>
          <div>
            <span className={styles.textureEyebrow}>EXTERIOR-ONLY MVP</span>
            <h2 id="texture-pipeline-title">원제품 외관 기반 목업</h2>
          </div>
          <span className={styles.textureSourceBadge}>여권 지갑 외관</span>
        </header>

        <section
          aria-labelledby="exterior-source-title"
          className={styles.exteriorSourceViews}
        >
          <header>
            <div>
              <h3 id="exterior-source-title">Meshy 사용 사진 4면</h3>
              <p>분석 접수 시 서버에 저장된 외관 사진을 사용합니다.</p>
            </div>
            <span>4 / 4</span>
          </header>
          <ul className={styles.exteriorViewList}>
            {EXTERIOR_VIEWS.map((view, index) => (
              <li key={view.id}>
                <span aria-hidden="true">{index + 1}</span>
                <strong>{view.koreanLabel}</strong>
                <small>{view.shortLabel}</small>
              </li>
            ))}
          </ul>
          <p className={styles.exteriorViewNote}>
            상단·하단 사진은 제품 상태 분석에만 사용하며 Meshy 4면 입력에서는
            제외합니다. 안감과 내부 소재는 이번 MVP에서 처리하지 않습니다.
          </p>
        </section>

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

        {overallProgress > 0 ? (
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
        ) : null}

        <section
          aria-labelledby="material-candidates-title"
          className={styles.materialCandidates}
        >
          <header>
            <div>
              <span className={styles.textureEyebrow}>MATERIAL PLAN</span>
              <h3 id="material-candidates-title">외관 소재 후보</h3>
            </div>
            <span>{exteriorPlan ? "AI 분석 완료" : "보수적 상태"}</span>
          </header>
          <div className={styles.materialCandidateGrid}>
            {EXTERIOR_PARTS.map((config) => (
              <MaterialCandidateCard
                config={config}
                key={config.id}
                part={
                  exteriorPlan?.parts.find((part) => part.part === config.id) ??
                  null
                }
              />
            ))}
          </div>
          {planError ? (
            <p className={styles.textureProviderHint}>
              외관 소재 자동 분류를 완료하지 못해 보수적인 기본 적용 규칙을
              사용합니다. {planError}
            </p>
          ) : null}
          {exteriorPlan?.warnings.length ? (
            <ul className={styles.materialWarnings}>
              {exteriorPlan.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </section>

        {textureBlob ? (
          <Button
            fullWidth
            onClick={() => setTextureEnabled((enabled) => !enabled)}
            size="medium"
            variant="outline"
          >
            {textureEnabled ? "기본 3D 모델과 비교" : "맞춤 외관 다시 적용"}
          </Button>
        ) : null}

        <section
          aria-labelledby="external-texture-title"
          className={styles.externalTextureControls}
        >
          <div>
            <span className={styles.textureEyebrow}>AI EXTERIOR PIPELINE</span>
            <h3 id="external-texture-title">외관 목업 생성</h3>
            <p>
              외관 소재 분류와 참고용 원제품 3D를 준비한 뒤, 여권 지갑 전용 UV
              소재 맵에 맞는 텍스처를 생성합니다.
            </p>
          </div>

          {!capabilities && !capabilitiesUnavailable ? (
            <p className={styles.textureStatus} role="status">
              AI 제공자 연결 상태를 확인하고 있습니다.
            </p>
          ) : null}

          {capabilitiesUnavailable ? (
            <p className={styles.textureError} role="status">
              외부 AI 연결 상태를 확인하지 못했습니다. 기본 여권 지갑 3D
              모델은 계속 확인할 수 있습니다.
            </p>
          ) : null}

          {capabilities ? (
            <>
              <label className={styles.externalTextureConsent}>
                <input
                  checked={externalConsentAccepted}
                  disabled={!targetAvailable || generationComplete}
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

              <div className={styles.exteriorGenerateAction}>
                <Button
                  disabled={generationDisabled}
                  fullWidth
                  onClick={() => void startExteriorPipeline()}
                  size="medium"
                  variant="secondary"
                >
                  {generationButtonLabel}
                </Button>
              </div>

              {!targetAvailable ? (
                <p className={styles.textureProviderHint}>
                  필수 Meshy 목표 텍스처 기능이 비활성화되어 있습니다. API 키,
                  공개 목업 URL과 작업 서명 설정을 확인해 주세요.
                </p>
              ) : !capabilities.features.exteriorPlan ||
                !capabilities.features.sourceModel ? (
                <p className={styles.textureProviderHint}>
                  비활성화된 선택 단계는 건너뜁니다. 참고용 원제품 3D 실패나
                  미사용은 최종 여권 지갑 외관 생성에 영향을 주지 않습니다.
                </p>
              ) : (
                <p className={styles.textureProviderHint}>
                  원제품 3D는 소재 확인을 위한 참고 결과이며 최종 여권 지갑
                  모델을 교체하지 않습니다.
                </p>
              )}
            </>
          ) : null}

          {sourceTask.error ? (
            <p className={styles.textureProviderHint}>
              참고용 원제품 3D는 준비하지 못했지만 외관 목업 생성은 계속할 수
              있습니다. {sourceTask.error}
            </p>
          ) : null}
          {externalStatus ? (
            <p className={styles.textureStatus} role="status">
              {externalStatus}
            </p>
          ) : null}
          {externalError ? (
            <p className={styles.textureError} role="alert">
              {externalError} 기본 여권 지갑 모델로 표시합니다.
            </p>
          ) : null}
          {applicationState === "error" && textureBlob ? (
            <p className={styles.textureError} role="alert">
              합성한 외관 텍스처를 브라우저 3D 모델에 적용하지 못했습니다.
            </p>
          ) : null}
        </section>

        <p className={styles.textureDisclaimer}>
          외관 4면을 바탕으로 만든 주문 전 예상 목업입니다. 안감은 반영하지
          않으며, 소재 후보와 UV 배치는 실제 재단 위치·무늬 연결·완성품을
          정확히 보장하지 않습니다. 지퍼와 금속 부자재는 검수된 목표 모델의
          기본 소재를 유지합니다.
        </p>
      </section>
    </div>
  );
}

function MaterialCandidateCard({
  config,
  part,
}: {
  config: (typeof EXTERIOR_PARTS)[number];
  part: ExteriorMaterialPart | null;
}) {
  return (
    <article
      className={styles.materialCandidateCard}
      data-observation={part?.observation ?? "PENDING"}
    >
      <header>
        <div>
          <small>{config.id}</small>
          <h4>{config.label}</h4>
        </div>
        <span>{part ? observationLabel(part.observation) : "확인 전"}</span>
      </header>
      <p>{part ? appearanceLabel(part) : config.description}</p>
      <dl>
        <div>
          <dt>적용</dt>
          <dd>
            {part
              ? transferModeLabel(part.transferMode)
              : conservativeTransferLabel(config.id)}
          </dd>
        </div>
        {part ? (
          <>
            <div>
              <dt>근거</dt>
              <dd>{evidenceViewLabel(part.evidenceViews)}</dd>
            </div>
            <div>
              <dt>신뢰도</dt>
              <dd>{Math.round(part.confidence * 100)}%</dd>
            </div>
          </>
        ) : null}
      </dl>
    </article>
  );
}

function appearanceLabel(part: ExteriorMaterialPart) {
  if (part.observation === "NOT_OBSERVED") {
    return "외관 4면에서 확인되지 않았습니다.";
  }
  const descriptions = [
    part.appearance.materialFamily,
    part.appearance.patternDescription,
    part.appearance.finishDescription,
    part.appearance.colors.length
      ? `색상 ${part.appearance.colors.join(", ")}`
      : null,
  ].filter((value): value is string => Boolean(value));
  return descriptions.join(" · ") || "사진 근거가 제한되어 보수적으로 분류했습니다.";
}

function conservativeTransferLabel(part: ExteriorPart) {
  if (part === "BODY") return "외관 주 소재 후보 생성 예정";
  if (part === "TRIM") return "확인되지 않으면 기본 트리밍 유지";
  if (part === "STRAP") return "이번 여권 지갑에는 미적용";
  return "목표 모델 기본 PBR 유지";
}

function transferModeLabel(mode: ExteriorMaterialPart["transferMode"]) {
  if (mode === "GENERATE_SWATCH") return "외관 소재 후보 생성";
  if (mode === "KEEP_TARGET_PBR") return "목표 모델 기본 PBR 유지";
  return "이번 여권 지갑에는 미적용";
}

function observationLabel(observation: ExteriorMaterialPart["observation"]) {
  if (observation === "PRESENT") return "감지됨";
  if (observation === "NOT_OBSERVED") return "미감지";
  return "불확실";
}

function evidenceViewLabel(views: ExteriorView[]) {
  if (views.length === 0) return "직접 근거 없음";
  const labelByView: Record<ExteriorView, string> = {
    FRONT: "정면",
    LEFT: "좌측면",
    REAR: "후면",
    RIGHT: "우측면",
  };
  return views.map((view) => labelByView[view]).join(" · ");
}

function sourceModelStepDetail(
  capabilities: TextureProviderCapabilities | null,
  task: MeshyUiState,
) {
  if (capabilities && !capabilities.features.sourceModel) {
    return "선택 기능 비활성화 · 최종 목업에는 영향 없음";
  }
  if (task.status === "succeeded") {
    return "외관 4면 기반 참고 3D/PBR 준비 완료 · 최종 모델 교체 안 함";
  }
  if (task.status === "queued") return "Meshy 작업 대기 중";
  if (task.status === "running") return `Meshy 참고 3D 생성 중 ${task.progress}%`;
  if (task.status === "failed" || task.status === "canceled") {
    return "참고 3D 생략 · 목표 UV 텍스처 생성은 계속 가능";
  }
  return "활성화된 경우 목표 텍스처와 별도로 생성";
}

function sourceModelStepState(
  capabilities: TextureProviderCapabilities | null,
  task: MeshyUiState,
) {
  if (capabilities && !capabilities.features.sourceModel) return "skipped";
  if (task.status === "succeeded") return "complete";
  if (task.status === "queued" || task.status === "running") return "active";
  if (task.status === "failed" || task.status === "canceled") return "skipped";
  return "waiting";
}

function targetTextureStepDetail(task: MeshyUiState) {
  if (task.status === "succeeded") {
    return "Meshy 결과를 검수된 외관 마스크에 결정론적으로 합성 완료";
  }
  if (task.status === "queued") return "Meshy 작업 대기 중";
  if (task.status === "running") return `Meshy 목표 UV 생성 중 ${task.progress}%`;
  if (task.status === "failed" || task.status === "canceled") {
    return task.error ?? "목표 UV 텍스처 생성 실패";
  }
  return "여권 지갑 전용 UV와 외관 마스크를 기준으로 생성";
}

function targetTextureStepState(task: MeshyUiState) {
  if (task.status === "succeeded") return "complete";
  if (task.status === "queued" || task.status === "running") return "active";
  if (task.status === "failed" || task.status === "canceled") return "error";
  return "waiting";
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
    throw new Error(
      "보호된 텍스처 자산을 불러오지 못했습니다.",
    );
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
  if (task.status === "queued") return "Meshy 목표 UV 작업이 대기열에 있습니다.";
  if (task.status === "running") {
    return `Meshy가 여권 지갑 목표 UV 텍스처를 생성하고 있습니다. ${task.progress}%`;
  }
  if (task.status === "succeeded") return "Meshy 목표 UV 텍스처 생성이 완료됐습니다.";
  return task.errorMessage ?? "Meshy 목표 UV 텍스처를 완료하지 못했습니다.";
}

function readExternalError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();
  if (normalized.includes("credits")) {
    return "Meshy API credits가 부족합니다. 계정 잔액을 확인해 주세요.";
  }
  if (normalized.includes("quota") || normalized.includes("rate limit")) {
    return "오늘 사용할 수 있는 외관 AI 생성 횟수를 초과했습니다.";
  }
  if (normalized.includes("not enabled")) {
    return "이 배포 환경에서 선택한 외관 AI 기능이 활성화되지 않았습니다.";
  }
  return message || "외관 AI 텍스처 처리에 실패했습니다.";
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

function getTextureRequestKey(
  analysisId: string,
  jobKind: TextureJobKind,
) {
  const storageKey = textureRequestStorageKey(analysisId, jobKind);
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) return existing;

  const created = `texture-${jobKind.toLowerCase()}-${crypto.randomUUID()}`;
  window.sessionStorage.setItem(storageKey, created);
  return created;
}
