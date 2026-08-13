import type { ReactNode } from "react";
import styles from "./layout.module.css";

type SectionProps = {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  title?: ReactNode;
};

export function Section({
  action,
  children,
  className,
  description,
  title,
}: SectionProps) {
  return (
    <section
      className={[styles.section, className].filter(Boolean).join(" ")}
    >
      {title || description || action ? (
        <header className={styles.sectionHeader}>
          <div className={styles.sectionCopy}>
            {title ? <h2>{title}</h2> : null}
            {description ? <p>{description}</p> : null}
          </div>
          {action ? <div className={styles.sectionAction}>{action}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
