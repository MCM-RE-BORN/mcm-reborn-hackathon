import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./layout.module.css";

type PageHeaderProps = {
  backHref?: string;
  description?: ReactNode;
  rightSlot?: ReactNode;
  title?: ReactNode;
};

export function PageHeader({
  backHref,
  description,
  rightSlot,
  title,
}: PageHeaderProps) {
  const hasCopy = Boolean(title || description);
  const headerClassName = [styles.pageHeader, hasCopy ? "" : styles.pageHeaderCompact]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={headerClassName}>
      <div className={styles.pageHeaderTopRow}>
        {backHref ? (
          <Link
            aria-label="이전 화면으로 이동"
            className={styles.backLink}
            href={backHref}
          >
            <Image
              alt=""
              aria-hidden="true"
              height={13}
              loading="eager"
              src="/assets/mvp-beta/icon-back.svg"
              width={15}
            />
          </Link>
        ) : (
          <span aria-hidden="true" className={styles.headerSpacer} />
        )}
        {rightSlot ? <div className={styles.headerRightSlot}>{rightSlot}</div> : null}
      </div>
      {title || description ? (
        <div className={styles.pageHeaderCopy}>
          {title ? <h1>{title}</h1> : null}
          {description ? <p>{description}</p> : null}
        </div>
      ) : null}
    </header>
  );
}
