"use client";

import { useEffect, useRef, useState } from "react";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import styles from "./analysis-design.module.css";

const MODEL_SRC = "/assets/models/reborn-passport-wallet.glb";
const PROMPT_RESET_DELAY_MS = 10_000;
const MODEL_LOAD_TIMEOUT_MS = 20_000;

type ModelViewerTexture = object;

type ModelViewerTextureInfo = {
  setTexture: (texture: ModelViewerTexture | null) => void;
  texture: ModelViewerTexture | null;
};

type ModelViewerMaterial = {
  pbrMetallicRoughness: {
    baseColorTexture: ModelViewerTextureInfo | null;
  };
};

type ModelViewerHandle = HTMLElement & {
  createTexture: (
    uri: string,
    type?: string,
  ) => Promise<ModelViewerTexture | null>;
  loaded: boolean;
  model?: {
    getMaterialByName: (name: string) => ModelViewerMaterial | null;
    materials: readonly ModelViewerMaterial[];
  };
  resetInteractionPrompt: () => void;
};

export type TextureApplicationState =
  | "applied"
  | "error"
  | "idle"
  | "loading";

type MockupViewerProps = {
  modelLoadTimeoutMs?: number;
  modelSrc?: string;
  onModelError?: () => void;
  onModelLoad?: () => void;
  onTextureStateChange?: (state: TextureApplicationState) => void;
  textureBlob?: Blob;
};

export function MockupViewer({
  modelLoadTimeoutMs = MODEL_LOAD_TIMEOUT_MS,
  modelSrc = MODEL_SRC,
  onModelError,
  onModelLoad,
  onTextureStateChange,
  textureBlob,
}: MockupViewerProps) {
  const [viewerReady, setViewerReady] = useState(false);
  const [modelFailed, setModelFailed] = useState(false);
  const [textureState, setTextureState] =
    useState<TextureApplicationState>("idle");
  const viewerRef = useRef<ModelViewerHandle | null>(null);
  const originalTextureRef = useRef<
    ModelViewerTexture | null | undefined
  >(undefined);
  const originalTextureModelRef = useRef<string | null>(null);
  const reportedModelLoadRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    void import("@google/model-viewer")
      .then(() => {
        if (active) setViewerReady(true);
      })
      .catch(() => {
        if (active) {
          setModelFailed(true);
          onModelError?.();
        }
      });

    return () => {
      active = false;
    };
  }, [onModelError]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewerReady || !viewer) return;

    let resetTimer: ReturnType<typeof setTimeout> | undefined;
    const handleCameraChange = (event: Event) => {
      const source = (event as CustomEvent<{ source?: string }>).detail?.source;
      if (source !== "user-interaction") return;

      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        viewer.resetInteractionPrompt();
      }, PROMPT_RESET_DELAY_MS);
    };

    viewer.addEventListener("camera-change", handleCameraChange);
    return () => {
      viewer.removeEventListener("camera-change", handleCameraChange);
      if (resetTimer) clearTimeout(resetTimer);
    };
  }, [viewerReady]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewerReady || !viewer || modelFailed || viewer.loaded) return;

    const clearLoadTimeout = () => window.clearTimeout(loadTimeout);
    const loadTimeout = window.setTimeout(() => {
      setModelFailed(true);
      onModelError?.();
    }, modelLoadTimeoutMs);
    viewer.addEventListener("error", clearLoadTimeout, { once: true });
    viewer.addEventListener("load", clearLoadTimeout, { once: true });

    return () => {
      window.clearTimeout(loadTimeout);
      viewer.removeEventListener("error", clearLoadTimeout);
      viewer.removeEventListener("load", clearLoadTimeout);
    };
  }, [
    modelFailed,
    modelLoadTimeoutMs,
    modelSrc,
    onModelError,
    viewerReady,
  ]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewerReady || !viewer || modelFailed) return;

    let cancelled = false;
    if (originalTextureModelRef.current !== modelSrc) {
      originalTextureModelRef.current = modelSrc;
      originalTextureRef.current = undefined;
    }

    const reportState = (state: TextureApplicationState) => {
      if (cancelled) return;
      setTextureState(state);
      onTextureStateChange?.(state);
    };

    const applyTexture = async () => {
      if (!viewer.loaded || !viewer.model) return;

      const material =
        viewer.model.getMaterialByName("Material_0") ??
        viewer.model.materials[0];
      const textureInfo =
        material?.pbrMetallicRoughness.baseColorTexture ?? null;
      if (!textureInfo) {
        if (!textureBlob) {
          reportState("idle");
          return;
        }
        reportState("error");
        return;
      }

      if (originalTextureRef.current === undefined) {
        originalTextureRef.current = textureInfo.texture;
      }

      if (!textureBlob) {
        textureInfo.setTexture(originalTextureRef.current ?? null);
        reportState("idle");
        return;
      }

      reportState("loading");
      const textureUrl = URL.createObjectURL(textureBlob);
      try {
        const texture = await viewer.createTexture(
          textureUrl,
          textureBlob.type || "image/jpeg",
        );
        if (cancelled) return;
        if (!texture) {
          throw new Error("MODEL_VIEWER_TEXTURE_EMPTY");
        }
        textureInfo.setTexture(texture);
        reportState("applied");
      } catch {
        if (!cancelled) {
          textureInfo.setTexture(originalTextureRef.current ?? null);
          reportState("error");
        }
      } finally {
        URL.revokeObjectURL(textureUrl);
      }
    };

    const reportModelLoad = () => {
      if (reportedModelLoadRef.current === modelSrc) return;
      reportedModelLoadRef.current = modelSrc;
      onModelLoad?.();
    };

    const handleModelLoad = () => {
      originalTextureRef.current = undefined;
      reportModelLoad();
      void applyTexture();
    };

    viewer.addEventListener("load", handleModelLoad);
    if (viewer.loaded) {
      reportModelLoad();
      void applyTexture();
    }

    return () => {
      cancelled = true;
      viewer.removeEventListener("load", handleModelLoad);
    };
  }, [
    modelFailed,
    modelSrc,
    onModelLoad,
    onTextureStateChange,
    textureBlob,
    viewerReady,
  ]);

  return (
    <section
      aria-label="RE:BORN 여권지갑 3D 목업"
      className={styles.modelViewerFrame}
    >
      {!viewerReady && !modelFailed ? (
        <div className={styles.modelViewerLoading} role="status">
          <LoadingIndicator className={styles.modelViewerLoadingSpinner} />
          3D 목업을 불러오고 있습니다.
        </div>
      ) : null}

      {viewerReady && !modelFailed ? (
        <model-viewer
          alt="드래그하여 회전하고 확대할 수 있는 RE:BORN 여권지갑 3D 목업"
          auto-rotate
          camera-controls
          camera-orbit="35deg 72deg auto"
          class={styles.modelViewer}
          environment-image="neutral"
          interaction-prompt="auto"
          interaction-prompt-style="wiggle"
          interaction-prompt-threshold="800"
          loading="eager"
          onError={() => {
            setModelFailed(true);
            onModelError?.();
          }}
          key={modelSrc}
          ref={viewerRef}
          rotation-per-second="18deg"
          shadow-intensity="1"
          src={modelSrc}
          touch-action="pan-y"
        />
      ) : null}

      {textureState === "loading" && !modelFailed ? (
        <div className={styles.textureApplying} role="status">
          외관 소재를 여권 지갑 목업에 적용하고 있습니다.
        </div>
      ) : null}

      {modelFailed ? (
        <div className={styles.modelViewerFallback} role="status">
          <strong>3D 목업을 불러오지 못했습니다.</strong>
          <p>브라우저의 WebGL 설정을 확인한 뒤 다시 시도해 주세요.</p>
        </div>
      ) : null}
    </section>
  );
}
