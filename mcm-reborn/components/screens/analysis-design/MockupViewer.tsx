"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import styles from "./analysis-design.module.css";

const MODEL_SRC = "/assets/models/reborn-passport-wallet.glb";
const MODEL_POSTER = "/assets/mvp-beta/passport-wallet-front.png";

export function MockupViewer() {
  const [viewerReady, setViewerReady] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelFailed, setModelFailed] = useState(false);

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

  return (
    <section
      aria-label="RE:BORN 여권지갑 3D 목업"
      className={styles.modelViewerFrame}
    >
      {!modelLoaded && (
        <Image
          alt="RE:BORN 여권지갑 3D 목업을 불러오는 중"
          className={styles.modelViewerPoster}
          fill
          priority
          sizes="(max-width: 402px) calc(100vw - 40px), 350px"
          src={MODEL_POSTER}
        />
      )}

      {viewerReady && !modelFailed ? (
        <model-viewer
          alt="드래그하여 회전하고 확대할 수 있는 RE:BORN 여권지갑 3D 목업"
          auto-rotate
          camera-controls
          camera-orbit="35deg 72deg auto"
          class={styles.modelViewer}
          environment-image="neutral"
          interaction-prompt="auto"
          loading="eager"
          onError={() => setModelFailed(true)}
          onLoad={() => setModelLoaded(true)}
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
