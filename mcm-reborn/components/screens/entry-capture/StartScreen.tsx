"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { useCustomerData } from "../order-certificate/CustomerDataProvider";
import styles from "./entry-capture.module.css";

type StartScreenProps = {
  bootstrapCustomer?: boolean;
};

const MINIMUM_SPLASH_MS = 1_000;

export function StartScreen({ bootstrapCustomer = false }: StartScreenProps) {
  const router = useRouter();
  const { bootstrap } = useCustomerData();
  const [imageReady, setImageReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [transitionError, setTransitionError] = useState(false);

  useEffect(() => {
    if (!imageReady) return;

    let cancelled = false;
    let delayId = 0;
    const targetHref = bootstrapCustomer ? "/home" : "/intro";
    router.prefetch(targetHref);

    const minimumDelay = new Promise<void>((resolve) => {
      delayId = window.setTimeout(resolve, MINIMUM_SPLASH_MS);
    });
    const dataReady = bootstrapCustomer ? bootstrap() : Promise.resolve();

    void Promise.all([minimumDelay, dataReady])
      .then(() => {
        if (!cancelled) {
          router.replace(targetHref);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTransitionError(true);
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(delayId);
    };
  }, [bootstrap, bootstrapCustomer, imageReady, retryCount, router]);

  return (
    <AppShell
      contentClassName={styles.startContent}
      contentWidth="full"
      immersive
    >
      <div className={styles.startScreen}>
        <Image
          alt=""
          aria-hidden="true"
          className={styles.startImage}
          fill
          onError={() => setImageReady(true)}
          onLoad={() => setImageReady(true)}
          priority
          sizes="(max-width: 402px) 100vw, 402px"
          src="/assets/mvp-beta/intro-start-hero.png"
        />
        <span aria-hidden="true" className={styles.startScrim} />
        <h1 className={styles.visuallyHidden}>MCM RE:BORN</h1>
        <span className={styles.startTagline}>
          EST 1976. HERITAGE UPCYCLING
        </span>
        <div
          aria-live="polite"
          className={styles.startTransitionStatus}
          role="status"
        >
          {transitionError ? (
            <>
              <span>초기 정보를 불러오지 못했습니다.</span>
              <button
                className={styles.startRetryButton}
                onClick={() => {
                  setTransitionError(false);
                  setRetryCount((count) => count + 1);
                }}
                type="button"
              >
                다시 시도
              </button>
            </>
          ) : (
            <>
              <LoadingIndicator className={styles.startLoadingIndicator} />
              <span>
                {bootstrapCustomer
                  ? "고객 정보를 불러오고 있습니다."
                  : "서비스 소개로 이동합니다."}
              </span>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
