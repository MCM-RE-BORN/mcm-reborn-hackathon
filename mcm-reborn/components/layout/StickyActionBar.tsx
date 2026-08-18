import type { ReactNode } from "react";
import styles from "./layout.module.css";

type StickyActionBarProps = {
  children: ReactNode;
  className?: string;
};

export function StickyActionBar({
  children,
  className,
}: StickyActionBarProps) {
  return (
    <div
      className={[styles.stickyActionBar, className]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={styles.stickyActionInner}>{children}</div>
    </div>
  );
}
