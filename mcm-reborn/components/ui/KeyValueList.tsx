import type { ReactNode } from "react";
import styles from "./ui.module.css";

export type KeyValueItem = {
  emphasis?: boolean;
  label: ReactNode;
  value: ReactNode;
};

type KeyValueListProps = {
  className?: string;
  dividers?: boolean;
  items: KeyValueItem[];
};

export function KeyValueList({
  className,
  dividers = false,
  items,
}: KeyValueListProps) {
  return (
    <dl
      className={[styles.keyValueList, className].filter(Boolean).join(" ")}
    >
      {items.map((item, index) => (
        <div
          className={[
            styles.keyValueRow,
            dividers && index > 0 ? styles.keyValueRowDivider : "",
            item.emphasis ? styles.keyValueRowEmphasis : "",
          ]
            .filter(Boolean)
            .join(" ")}
          key={`${String(item.label)}-${index}`}
        >
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
