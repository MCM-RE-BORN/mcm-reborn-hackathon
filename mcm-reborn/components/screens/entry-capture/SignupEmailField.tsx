import fieldStyles from "@/components/ui/ui.module.css";
import styles from "./entry-capture.module.css";

type SignupEmailFieldProps = {
  hasError?: boolean;
};

/*
 * Figma's "회원가입 화면" (node 228:1510) splits the email field into a
 * local-part / "@" / domain-part row instead of one full-address input.
 * `TextField` only supports a single input per label, so this reuses its
 * underlying `ui.module.css` classes directly to build the same label +
 * row structure by hand.
 */
export function SignupEmailField({ hasError = false }: SignupEmailFieldProps) {
  return (
    <div className={fieldStyles.field}>
      <div className={fieldStyles.fieldLabelRow}>
        <label className={fieldStyles.fieldLabel} htmlFor="signup-email-local">
          이메일 주소<span aria-hidden="true"> *</span>
        </label>
      </div>
      <div className={styles.splitFieldRow}>
        <input
          aria-describedby={hasError ? "signup-email-error" : undefined}
          aria-invalid={hasError ? true : undefined}
          // The browser only sees two plain text inputs next to an "이메일
          // 주소" label, so its email-autofill heuristic offers the full
          // address for either one and — since it can't tell they're two
          // halves of one field — fills the complete address into both.
          // autoComplete="off" opts this local-part input out of that
          // heuristic so autofill no longer overwrites the domain input.
          autoComplete="off"
          className={`${fieldStyles.input} ${fieldStyles["input-compact"]}`}
          id="signup-email-local"
          name="signup-email-local"
          placeholder="example"
          required
          type="text"
        />
        <span aria-hidden="true" className={styles.fieldDivider}>
          @
        </span>
        <input
          aria-describedby={hasError ? "signup-email-error" : undefined}
          aria-invalid={hasError ? true : undefined}
          autoComplete="off"
          className={`${fieldStyles.input} ${fieldStyles["input-compact"]}`}
          id="signup-email-domain"
          name="signup-email-domain"
          placeholder="email.com"
          required
          type="text"
        />
      </div>
      {hasError ? (
        <p className={fieldStyles.fieldError} id="signup-email-error" role="alert">
          이미 가입된 이메일입니다.
        </p>
      ) : null}
    </div>
  );
}
