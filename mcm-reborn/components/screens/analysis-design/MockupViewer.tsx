"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import styles from "./analysis-design.module.css";

const VIEWS = [
  {
    label: "정면",
    alt: "RE:BORN 여권지갑 정면 예상 목업",
    image: "/assets/mvp-beta/passport-wallet-front.png",
  },
  {
    label: "내부",
    alt: "RE:BORN 여권지갑 내부 예상 목업",
    image: "/assets/mvp-beta/passport-wallet-open.png",
  },
  {
    label: "후면",
    alt: "RE:BORN 여권지갑 후면 예상 목업",
    image: "/assets/mvp-beta/passport-wallet-back.png",
  },
] as const;

export function MockupViewer() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const dragStartX = useRef<number | undefined>(undefined);
  const currentView = VIEWS[currentIndex];

  const showPrevious = () => {
    setCurrentIndex((current) => (current - 1 + VIEWS.length) % VIEWS.length);
  };

  const showNext = () => {
    setCurrentIndex((current) => (current + 1) % VIEWS.length);
  };

  return (
    <section aria-label="RE:BORN 여권지갑 3D 목업 미리보기">
      <div
        className={styles.mockupHero}
        onPointerDown={(event) => {
          dragStartX.current = event.clientX;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={(event) => {
          const startX = dragStartX.current;
          dragStartX.current = undefined;
          if (startX === undefined) return;

          const distance = event.clientX - startX;
          if (Math.abs(distance) < 32) return;
          if (distance > 0) showPrevious();
          else showNext();
        }}
      >
        <Image
          alt={currentView.alt}
          fill
          priority
          sizes="(max-width: 360px) calc(100vw - 40px), (max-width: 402px) calc(100vw - 52px), 350px"
          src={currentView.image}
          style={{ transform: `scale(${zoom})` }}
        />
        <span className={styles.mockupViewLabel}>{currentView.label}</span>
      </div>

      <div className={styles.mockupControls}>
        <button aria-label="이전 각도" onClick={showPrevious} type="button">
          ←
        </button>
        <span aria-live="polite">
          {currentIndex + 1} / {VIEWS.length}
        </span>
        <button aria-label="다음 각도" onClick={showNext} type="button">
          →
        </button>
        <button
          aria-label="목업 축소"
          disabled={zoom <= 1}
          onClick={() => setZoom((current) => Math.max(1, current - 0.2))}
          type="button"
        >
          −
        </button>
        <button
          aria-label="목업 확대"
          disabled={zoom >= 1.4}
          onClick={() => setZoom((current) => Math.min(1.4, current + 0.2))}
          type="button"
        >
          +
        </button>
      </div>

      <div aria-label="목업 각도 선택" className={styles.mockupThumbnails}>
        {VIEWS.map((view, index) => (
          <button
            aria-pressed={index === currentIndex}
            key={view.image}
            onClick={() => setCurrentIndex(index)}
            type="button"
          >
            <Image alt="" aria-hidden="true" fill sizes="72px" src={view.image} />
            <span>{view.label}</span>
          </button>
        ))}
      </div>
      <p className={styles.mockupInteractionHint}>
        좌우로 밀거나 화살표를 눌러 각도를 바꾸고, +/−로 확대해보세요.
      </p>
    </section>
  );
}
