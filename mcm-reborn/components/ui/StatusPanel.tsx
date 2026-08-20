import type { ReactNode } from "react";
import styles from "./ui.module.css";

export type StatusTone =
  | "loading"
  | "empty"
  | "error"
  | "permission"
  | "success";

type StatusPanelProps = {
  action?: ReactNode;
  description: ReactNode;
  title: ReactNode;
  tone: StatusTone;
};

const MARKS: Record<StatusTone, string> = {
  loading: "…",
  empty: "—",
  error: "!",
  permission: "i",
  success: "✓",
};

export function StatusPanel({
  action,
  description,
  title,
  tone,
}: StatusPanelProps) {
  const isUrgent = tone === "error";
  const isLoading = tone === "loading";

  return (
    <section
      aria-busy={isLoading || undefined}
      aria-live={isUrgent ? "assertive" : "polite"}
      className={[styles.statusPanel, styles[`statusPanel-${tone}`]].join(" ")}
      role={isUrgent ? "alert" : "status"}
    >
      {isLoading ? (
        <span aria-hidden="true" className={styles.statusSpinner} />
      ) : (
        <span aria-hidden="true" className={styles.statusMark}>
          {MARKS[tone]}
        </span>
      )}
      <div className={styles.statusCopy}>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action ? <div className={styles.statusAction}>{action}</div> : null}
    </section>
  );
}
