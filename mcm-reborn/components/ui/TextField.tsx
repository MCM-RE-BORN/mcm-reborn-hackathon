import type { InputHTMLAttributes, ReactNode } from "react";
import styles from "./ui.module.css";

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  density?: "compact" | "comfortable";
  error?: string;
  hideLabel?: boolean;
  hint?: string;
  id: string;
  label: string;
  labelAction?: ReactNode;
};

export function TextField({
  "aria-describedby": ariaDescribedBy,
  className,
  density = "comfortable",
  error,
  hideLabel = false,
  hint,
  id,
  label,
  labelAction,
  required,
  ...props
}: TextFieldProps) {
  if (!id) {
    throw new Error("TextField requires an id so its label stays accessible.");
  }

  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [ariaDescribedBy, hintId, errorId]
    .filter(Boolean)
    .join(" ");
  const inputClasses = [
    styles.input,
    styles[`input-${density}`],
    error ? styles.inputError : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.field}>
      <div className={hideLabel ? styles.visuallyHidden : styles.fieldLabelRow}>
        <label className={styles.fieldLabel} htmlFor={id}>
          {label}
          {required ? <span aria-hidden="true"> *</span> : null}
        </label>
        {labelAction}
      </div>
      <input
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : undefined}
        className={inputClasses}
        id={id}
        required={required}
        {...props}
      />
      {hint ? (
        <p className={styles.fieldHint} id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className={styles.fieldError} id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
