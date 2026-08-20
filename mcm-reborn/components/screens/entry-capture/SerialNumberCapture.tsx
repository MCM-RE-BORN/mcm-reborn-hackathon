"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import {
  SERIAL_NUMBER_PATTERN,
  type CaptureSlotId,
} from "./capture-config";
import { useCaptureSession } from "./CaptureSessionProvider";
import styles from "./serial-number-capture.module.css";

type SerialNumberCaptureProps = {
  completedSlotIds: CaptureSlotId[];
};

type Verification = {
  kind: "error" | "success";
  value: string;
};

export function SerialNumberCapture({
  completedSlotIds,
}: SerialNumberCaptureProps) {
  const { productDetails, updateProductDetails } = useCaptureSession();
  const [verification, setVerification] = useState<Verification>();
  const isCaptured = completedSlotIds.includes("serialNumber");
  const completedQuery = completedSlotIds.length
    ? `&completed=${completedSlotIds.join(",")}`
    : "";
  const visibleVerification =
    verification?.value === productDetails.serialNumber
      ? verification
      : undefined;
  const messageId = visibleVerification
    ? "serial-number-verification-message"
    : undefined;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setVerification({
      kind: SERIAL_NUMBER_PATTERN.test(productDetails.serialNumber)
        ? "success"
        : "error",
      value: productDetails.serialNumber,
    });
  };

  return (
    <section
      aria-labelledby="serial-number-capture-title"
      className={styles.serialNumberCapture}
    >
      <h3 className={styles.visuallyHidden} id="serial-number-capture-title">
        시리얼 번호 등록
      </h3>

      <form className={styles.verificationForm} noValidate onSubmit={handleSubmit}>
        <div className={styles.labelRow}>
          <label className={styles.label} htmlFor="product-serial-number">
            시리얼 번호 <b aria-hidden="true">*</b>
          </label>
          <p className={styles.hint} id="serial-number-format-hint">
            영문과 숫자를 조합한 11자리 번호를 입력해주세요.
          </p>
        </div>
        <div className={styles.verificationRow}>
          <input
            aria-describedby={[
              "serial-number-format-hint",
              messageId,
            ]
              .filter(Boolean)
              .join(" ")}
            aria-invalid={visibleVerification?.kind === "error" || undefined}
            autoCapitalize="characters"
            className={styles.input}
            id="product-serial-number"
            inputMode="text"
            maxLength={11}
            onChange={(event) => {
              updateProductDetails({ serialNumber: event.currentTarget.value });
              setVerification(undefined);
            }}
            pattern="(?=.*[A-Za-z])(?=.*[0-9])[A-Za-z0-9]{11}"
            placeholder="예: MK123456789"
            required
            spellCheck={false}
            value={productDetails.serialNumber}
          />
          <Button size="medium" type="submit">
            인증
          </Button>
        </div>
        {visibleVerification ? (
          <p
            aria-live={visibleVerification.kind === "error" ? "assertive" : "polite"}
            className={
              visibleVerification.kind === "success"
                ? styles.successMessage
                : styles.errorMessage
            }
            id="serial-number-verification-message"
            role={visibleVerification.kind === "error" ? "alert" : "status"}
          >
            {visibleVerification.kind === "success"
              ? "시리얼 번호 인증이 완료되었습니다."
              : "시리얼 번호는 영문과 숫자 11자리로 입력해주세요."}
          </p>
        ) : null}
      </form>

      <ButtonLink
        aria-label={`시리얼 번호 사진 ${isCaptured ? "다시 " : ""}촬영하여 입력`}
        className={styles.captureButton}
        fullWidth
        href={`/products/new/camera?slot=serialNumber${completedQuery}`}
        variant="outline"
      >
        <Image
          alt=""
          aria-hidden="true"
          height={31}
          src="/assets/mvp-beta/icon-barcode.svg"
          width={50}
        />
        <span className={styles.captureButtonCopy}>
          <span>시리얼 번호 촬영하여 입력</span>
        </span>
        <span aria-hidden="true" className={styles.captureButtonChevron} />
      </ButtonLink>
    </section>
  );
}
