"use client";

import { useState } from "react";
import { TextField } from "@/components/ui/TextField";
import styles from "./entry-capture.module.css";

const PASSWORD_RULES = [
  {
    id: "length",
    label: "최소 8자 이상",
    test: (value: string) => value.length >= 8,
  },
  {
    id: "uppercase",
    label: "영문 대문자 최소 1개 이상",
    test: (value: string) => /[A-Z]/.test(value),
  },
] as const;

export function SignupPasswordField() {
  const [password, setPassword] = useState("");

  return (
    <div className={styles.passwordField}>
      <TextField
        autoComplete="new-password"
        density="compact"
        id="signup-password"
        label="비밀번호"
        onChange={(event) => setPassword(event.target.value)}
        placeholder="비밀번호를 입력해주세요"
        required
        type="password"
        value={password}
      />
      <ul aria-label="비밀번호 조건" className={styles.passwordRules}>
        {PASSWORD_RULES.map((rule) => {
          const met = rule.test(password);
          const markClassName = met
            ? `${styles.passwordRuleMark} ${styles.passwordRuleMarkMet}`
            : styles.passwordRuleMark;

          return (
            <li
              aria-checked={met}
              className={met ? styles.passwordRuleMet : undefined}
              key={rule.id}
              role="checkbox"
            >
              <span aria-hidden="true" className={markClassName} />
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
