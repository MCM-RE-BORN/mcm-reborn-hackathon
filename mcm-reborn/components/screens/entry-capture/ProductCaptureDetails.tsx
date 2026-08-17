"use client";

import { TextField } from "@/components/ui/TextField";
import { useCaptureSession } from "./CaptureSessionProvider";
import styles from "./entry-capture.module.css";

const USE_DURATIONS = ["1년 미만", "1~2년", "3~4년", "5년 이상"];
const DESIRED_USES = ["여권지갑", "카드지갑", "캐리어 네임택", "키링"];

export function ProductCaptureDetails() {
  const { productDetails, updateProductDetails } = useCaptureSession();

  return (
    <section aria-labelledby="product-info-title" className={styles.productInfo}>
      <div className={styles.captureSectionHeading}>
        <div>
          <h2 id="product-info-title">제품 정보</h2>
          <p>사진과 함께 분석할 제품 정보를 확인해주세요.</p>
        </div>
      </div>

      <fieldset className={styles.productTypeGroup}>
        <legend>제품 카테고리</legend>
        <label>
          <input checked name="product-category" readOnly type="radio" value="bag" />
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
          {USE_DURATIONS.map((duration) => (
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
          {DESIRED_USES.map((desiredUse) => (
            <option key={desiredUse} value={desiredUse}>
              {desiredUse}
            </option>
          ))}
        </select>
      </label>

      <TextField
        hint="제품 내부 라벨 또는 보증서의 번호가 있다면 입력해주세요."
        id="product-serial"
        label="시리얼 번호 (선택)"
        onChange={(event) =>
          updateProductDetails({ serialNumber: event.currentTarget.value })
        }
        placeholder="시리얼 번호 입력"
        value={productDetails.serialNumber}
      />

      <TextField
        id="product-note"
        label="현재 상태 메모 (선택)"
        onChange={(event) =>
          updateProductDetails({ conditionNote: event.currentTarget.value })
        }
        placeholder="오염이나 손상 부위를 알려주세요"
        value={productDetails.conditionNote}
      />
    </section>
  );
}
