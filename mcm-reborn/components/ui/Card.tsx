import type { HTMLAttributes, ReactNode } from "react";
import styles from "./ui.module.css";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  padding?: "none" | "compact" | "regular";
  tone?: "plain" | "surface" | "outline";
};

export function Card({
  children,
  className,
  padding = "regular",
  tone = "plain",
  ...props
}: CardProps) {
  const classes = [
    styles.card,
    styles[`card-${tone}`],
    styles[`card-${padding}`],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}
