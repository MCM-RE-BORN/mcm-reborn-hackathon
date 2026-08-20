import styles from "./ui.module.css";

type LoadingIndicatorProps = {
  className?: string;
};

export function LoadingIndicator({ className }: LoadingIndicatorProps) {
  return (
    <span
      aria-hidden="true"
      className={[styles.loadingIndicator, className].filter(Boolean).join(" ")}
    />
  );
}
