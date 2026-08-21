"use client";

import { useId, useState } from "react";
import { TextField } from "@/components/ui/TextField";
import {
  TEXTURE_PRIVACY_NOTICE_KO,
  TEXTURE_PRIVACY_NOTICE_VERSION,
} from "@/lib/texture-preview";
import {
  DESIRED_USE_OPTIONS,
  USE_DURATION_OPTIONS,
  useCaptureSession,
} from "./CaptureSessionProvider";
import styles from "./entry-capture.module.css";

export function ProductCaptureDetails() {
  const { productDetails, updateProductDetails } = useCaptureSession();
  const [consentDetailsExpanded, setConsentDetailsExpanded] = useState(false);
  const consentDetailsId = useId();
  const consentDetailsToggleId = useId();

  return (
    <section aria-labelledby="product-info-title" className={styles.productInfo}>
      <div
        className={`${styles.captureSectionHeading} ${styles.productInfoHeading}`}
      >
        <div>
          <h2 id="product-info-title">제품 정보</h2>
          <p>사진과 함께 분석할 제품 정보를 확인해주세요.</p>
        </div>
      </div>

      <fieldset className={styles.productTypeGroup}>
        <legend>제품 카테고리</legend>
        <label>
          <input checked name="product-category" readOnly type="radio" value="BACKPACK" />
          <span>가방</span>
        </label>
      </fieldset>

      <TextField
        id="product-purchase-year"
        inputMode="numeric"
        label="구매 시기 (연도)"
        max="2026"
        min="1976"
        onChange={(event) =>
          updateProductDetails({ purchaseYear: event.currentTarget.value })
        }
        placeholder="예: 2019"
        required
        type="number"
        value={productDetails.purchaseYear}
      />

      <label className={styles.captureSelectField} htmlFor="product-use-duration">
        <span>
          주요 사용 기간 <b aria-hidden="true">*</b>
        </span>
        <select
          id="product-use-duration"
          onChange={(event) =>
            updateProductDetails({ useDuration: event.currentTarget.value })
          }
          required
          value={productDetails.useDuration}
        >
          {USE_DURATION_OPTIONS.map((duration) => (
            <option key={duration} value={duration}>
              {duration}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.captureSelectField} htmlFor="product-desired-use">
        <span>
          희망 업사이클링 용도 <b aria-hidden="true">*</b>
        </span>
        <select
          id="product-desired-use"
          onChange={(event) =>
            updateProductDetails({ desiredUse: event.currentTarget.value })
          }
          required
          value={productDetails.desiredUse}
        >
          {DESIRED_USE_OPTIONS.map((desiredUse) => (
            <option key={desiredUse} value={desiredUse}>
              {desiredUse}
            </option>
          ))}
        </select>
      </label>

      <TextField
        id="product-note"
        label="현재 상태 메모 (선택)"
        onChange={(event) =>
          updateProductDetails({ conditionNote: event.currentTarget.value })
        }
        placeholder="오염이나 손상 부위를 알려주세요"
        value={productDetails.conditionNote}
      />

      <fieldset className={styles.consentGroup}>
        <legend className={styles.visuallyHidden}>
          AI 분석 및 3D 목업 외부 처리 동의
        </legend>
        <div className={styles.externalAiConsentSummary}>
          <label>
            <input
              checked={productDetails.externalAiProcessingConsentAccepted}
              onChange={(event) =>
                updateProductDetails({
                  externalAiProcessingConsentAccepted:
                    event.currentTarget.checked,
                })
              }
              required
              type="checkbox"
            />
            <span>AI 분석을 위한 사진 활용 동의</span>
          </label>
          <button
            aria-label={`AI 분석을 위한 사진 활용 동의 ${
              consentDetailsExpanded ? "내용접기" : "내용보기"
            }`}
            aria-controls={consentDetailsId}
            aria-expanded={consentDetailsExpanded}
            className={styles.externalAiConsentToggle}
            id={consentDetailsToggleId}
            onClick={() => setConsentDetailsExpanded((expanded) => !expanded)}
            type="button"
          >
            {consentDetailsExpanded ? "내용접기" : "내용보기"}
          </button>
        </div>
        <div
          aria-labelledby={consentDetailsToggleId}
          className={styles.externalAiConsentDetails}
          hidden={!consentDetailsExpanded}
          id={consentDetailsId}
          role="region"
        >
          <p>{TEXTURE_PRIVACY_NOTICE_KO}</p>
          <p className={styles.externalAiNoticeVersion}>
            개인정보 처리 안내 버전 {TEXTURE_PRIVACY_NOTICE_VERSION}
          </p>
        </div>
      </fieldset>
    </section>
  );
}
