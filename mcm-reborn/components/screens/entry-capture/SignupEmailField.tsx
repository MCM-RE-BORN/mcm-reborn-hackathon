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
          // Chrome's non-password ("profile") autofill heuristic looks at
          // this input's name/id and the nearby "이메일 주소" label, decides
          // both boxes are "the email field", and — since it can't tell
          // they're two halves of one address — fills the full address
          // into both when a suggestion is picked. Chromium deliberately
          // ignores plain autoComplete="off" for this non-password autofill
          // system (a known, long-standing Chrome behavior), so "off" alone
          // does not stop it. autoComplete="new-password" is the practical
          // workaround: Chrome/Firefox never autofill "new-password"
          // fields, so it reliably opts this input out. It's safe to use on
          // a plain text field — it does not turn the input into a
          // password field, and this form already has real password
          // fields, so it does not change the browser's save-password
          // prompt behavior for this form.
          autoComplete="new-password"
          className={`${fieldStyles.input} ${fieldStyles["input-compact"]}`}
          id="signup-email-local"
          name="signup-account-local"
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
          autoComplete="new-password"
          className={`${fieldStyles.input} ${fieldStyles["input-compact"]}`}
          id="signup-email-domain"
          name="signup-account-domain"
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
