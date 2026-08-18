import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import styles from "./entry-capture.module.css";

export function StartScreen() {
  return (
    <AppShell
      contentClassName={styles.startContent}
      contentWidth="full"
      immersive
    >
      <Link
        aria-label="MCM RE:BORN 서비스 소개 시작하기"
        className={styles.startScreen}
        href="/intro"
      >
        <Image
          alt=""
          aria-hidden="true"
          className={styles.startImage}
          fill
          priority
          sizes="(max-width: 402px) 100vw, 402px"
          src="/assets/mvp-beta/intro-start-hero.png"
        />
        <span aria-hidden="true" className={styles.startScrim} />
        <h1 className={styles.visuallyHidden}>MCM RE:BORN</h1>
        <span className={styles.startTagline}>
          EST 1976. HERITAGE UPCYCLING
        </span>
      </Link>
    </AppShell>
  );
}
