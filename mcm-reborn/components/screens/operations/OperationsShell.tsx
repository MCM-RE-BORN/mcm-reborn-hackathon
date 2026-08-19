import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./operations.module.css";

type OperationsShellProps = {
  children: ReactNode;
};

export function OperationsShell({ children }: OperationsShellProps) {
  return (
    <div className={styles.viewport}>
      <a className={styles.skipLink} href="#operations-main">
        본문으로 바로가기
      </a>
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <Link className={styles.brand} href="/operations">
            <span>MCM RE:BORN</span>
            <small>OPERATIONS</small>
          </Link>
          <div className={styles.consoleMeta}>
            <span>관리자 · 장인 통합</span>
            <strong>V2 OPERATOR</strong>
          </div>
        </div>
      </header>
      <main className={styles.main} id="operations-main">
        {children}
      </main>
    </div>
  );
}
