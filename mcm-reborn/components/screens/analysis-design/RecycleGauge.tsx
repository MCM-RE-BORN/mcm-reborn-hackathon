import Image from "next/image";
import styles from "./analysis-design.module.css";

type RecycleGaugeProps = {
  grade: string;
  value: number;
};

export function RecycleGauge({ grade, value }: RecycleGaugeProps) {
  const isLimited = grade === "C" || grade === "D";

  return (
    <figure
      aria-label={`예상 원단 재활용 가능률 ${value}퍼센트, ${grade}등급`}
      className={styles.gaugeFigure}
      role="img"
    >
      <div className={styles.gauge}>
        <Image
          alt=""
          aria-hidden="true"
          fill
          priority
          sizes="230px"
          src="/assets/mvp-beta/result-gauge-track.svg"
        />
        {isLimited ? (
          <Image
            alt=""
            aria-hidden="true"
            className={styles.gaugeLimitedProgress}
            height={112.666}
            priority
            src="/assets/mvp-beta/result-gauge-limited-progress.svg"
            width={74.7891}
          />
        ) : (
          <Image
            alt=""
            aria-hidden="true"
            className={styles.gaugeProgress}
            height={224.088}
            priority
            src="/assets/mvp-beta/result-gauge-progress.svg"
            width={226.915}
          />
        )}
        <strong className={styles.gaugeValue}>{value}%</strong>
      </div>
      <figcaption className={styles.gaugeGrade}>{grade}등급</figcaption>
    </figure>
  );
}
