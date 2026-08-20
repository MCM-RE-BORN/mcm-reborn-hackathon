"use client";

import { useEffect, useState, type MouseEvent } from "react";
import styles from "./entry-capture.module.css";

const VISIBILITY_SCROLL_THRESHOLD = 24;

export function IntroScrollOverlay() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const syncVisibility = () => {
      setIsVisible(window.scrollY < VISIBILITY_SCROLL_THRESHOLD);
    };

    syncVisibility();
    window.addEventListener("scroll", syncVisibility, { passive: true });
    return () => window.removeEventListener("scroll", syncVisibility);
  }, []);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const target = document.getElementById("intro-actions");
    if (!target) {
      return;
    }

    setIsVisible(false);
    target.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className={styles.introScrollOverlay}>
      <a
        className={styles.introScrollCue}
        href="#intro-actions"
        onClick={handleClick}
      >
        <span>스크롤하고 시작하기</span>
        <i aria-hidden="true" />
      </a>
    </div>
  );
}
