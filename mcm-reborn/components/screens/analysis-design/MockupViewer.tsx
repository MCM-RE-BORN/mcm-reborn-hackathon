"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./analysis-design.module.css";

const MODEL_SRC = "/assets/models/reborn-passport-wallet.glb";
const PROMPT_RESET_DELAY_MS = 3_000;

type ModelViewerHandle = HTMLElement & {
  resetInteractionPrompt: () => void;
};

export function MockupViewer() {
  const [viewerReady, setViewerReady] = useState(false);
  const [modelFailed, setModelFailed] = useState(false);
  const viewerRef = useRef<ModelViewerHandle | null>(null);

  useEffect(() => {
    let active = true;

    void import("@google/model-viewer")
      .then(() => {
        if (active) setViewerReady(true);
      })
      .catch(() => {
        if (active) setModelFailed(true);
      });

    return () => {
      active = false;
    };
  }, []);

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

  return (
    <section
      aria-label="RE:BORN 여권지갑 3D 목업"
      className={styles.modelViewerFrame}
    >
      {!viewerReady ? (
        <div className={styles.modelViewerLoading} role="status">
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
          onError={() => setModelFailed(true)}
          ref={viewerRef}
          rotation-per-second="18deg"
          shadow-intensity="1"
          src={MODEL_SRC}
          touch-action="pan-y"
        />
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
