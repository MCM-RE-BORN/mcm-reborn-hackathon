import type { ReactNode } from "react";
import styles from "./layout.module.css";

type AppShellProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  contentWidth?: "full" | "guttered";
  footer?: ReactNode;
  header?: ReactNode;
  immersive?: boolean;
};

export function AppShell({
  children,
  className,
  contentClassName,
  contentWidth = "guttered",
  footer,
  header,
  immersive = false,
}: AppShellProps) {
  const shellClasses = [
    styles.shell,
    immersive ? styles.shellImmersive : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const contentClasses = [
    styles.content,
    contentWidth === "guttered"
      ? styles.contentGuttered
      : styles.contentFull,
    contentClassName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.viewport}>
      <div className={shellClasses}>
        <a className={styles.skipLink} href="#main-content">
          본문으로 바로가기
        </a>
        {header}
        <main className={contentClasses} id="main-content">
          {children}
        </main>
        {footer}
      </div>
    </div>
  );
}
