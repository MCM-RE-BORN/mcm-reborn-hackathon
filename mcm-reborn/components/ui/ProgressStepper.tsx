import type { CSSProperties } from "react";
import styles from "./ui.module.css";

type ProgressStepperProps = {
  currentIndex: number;
  items: string[];
};

export function ProgressStepper({ currentIndex, items }: ProgressStepperProps) {
  const stepperStyle = {
    "--step-count": items.length,
  } as CSSProperties;

  return (
    <ol
      aria-label="진행 상태"
      className={styles.stepper}
      style={stepperStyle}
    >
      {items.map((item, index) => {
        const state =
          index < currentIndex
            ? "complete"
            : index === currentIndex
              ? "active"
              : "upcoming";

        return (
          <li
            aria-current={state === "active" ? "step" : undefined}
            className={[styles.step, styles[`step-${state}`]].join(" ")}
            key={item}
          >
            <span aria-hidden="true" className={styles.stepDot} />
            <span className={styles.stepLabel}>{item}</span>
          </li>
        );
      })}
    </ol>
  );
}
