import fieldStyles from "@/components/ui/ui.module.css";
import styles from "./entry-capture.module.css";

/*
 * Figma splits the phone field into a fixed-width country-code selector
 * ("82+") plus a flexible number input, instead of one full-width field.
 */
export function SignupPhoneField() {
  return (
    <div className={fieldStyles.field}>
      <div className={fieldStyles.fieldLabelRow}>
        <label className={fieldStyles.fieldLabel} htmlFor="signup-phone-number">
          전화번호<span aria-hidden="true"> *</span>
        </label>
      </div>
      <div className={styles.splitFieldRow}>
        <span
          className={`${fieldStyles.chevronMark} ${styles.phoneCountryCodeWrap}`}
        >
          <select
            aria-label="국가 번호"
            className={`${fieldStyles.input} ${fieldStyles["input-compact"]} ${styles.phoneCountryCode}`}
            defaultValue="82"
            id="signup-phone-country"
            name="signup-phone-country"
          >
            <option value="82">82+</option>
          </select>
        </span>
        <input
          autoComplete="tel-national"
          className={`${fieldStyles.input} ${fieldStyles["input-compact"]}`}
          id="signup-phone-number"
          name="signup-phone-number"
          placeholder="010-0000-0000"
          required
          type="tel"
        />
      </div>
    </div>
  );
}
