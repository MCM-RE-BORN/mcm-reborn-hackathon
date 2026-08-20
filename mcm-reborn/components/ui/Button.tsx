import Link from "next/link";
import type {
  ButtonHTMLAttributes,
  ComponentProps,
  ReactNode,
} from "react";
import { LoadingIndicator } from "./LoadingIndicator";
import styles from "./ui.module.css";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger";

export type ButtonSize = "small" | "medium" | "large";

type SharedButtonProps = {
  children: ReactNode;
  className?: string;
  fullWidth?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
};

export type ButtonProps = SharedButtonProps & {
  loading?: boolean;
  loadingLabel?: ReactNode;
} &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof SharedButtonProps>;

export type ButtonLinkProps = SharedButtonProps &
  Omit<ComponentProps<typeof Link>, keyof SharedButtonProps>;

function buttonClassName({
  className,
  fullWidth = false,
  size = "large",
  variant = "primary",
}: Pick<
  SharedButtonProps,
  "className" | "fullWidth" | "size" | "variant"
>) {
  return [
    styles.button,
    styles[`button-${variant}`],
    styles[`button-${size}`],
    fullWidth ? styles.buttonFullWidth : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  children,
  className,
  fullWidth,
  loading = false,
  loadingLabel,
  size,
  type = "button",
  variant,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      aria-busy={loading || undefined}
      className={buttonClassName({ className, fullWidth, size, variant })}
      disabled={disabled || loading}
      type={type}
      {...props}
    >
      {loading ? (
        <span className={styles.buttonLoadingContent}>
          <LoadingIndicator className={styles.buttonLoadingIndicator} />
          <span>{loadingLabel ?? children}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export function ButtonLink({
  children,
  className,
  fullWidth,
  size,
  variant,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={buttonClassName({ className, fullWidth, size, variant })}
      {...props}
    >
      {children}
    </Link>
  );
}
