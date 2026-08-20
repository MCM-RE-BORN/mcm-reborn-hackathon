"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  loginOperatorCredentials,
  OperatorApiError,
} from "./operator-client";
import styles from "./operations.module.css";

type OperatorLoginPanelProps = {
  onAuthenticated: () => void;
};

export function OperatorLoginPanel({
  onAuthenticated,
}: OperatorLoginPanelProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await loginOperatorCredentials(email, password);
      onAuthenticated();
    } catch (caughtError) {
      setError(
        caughtError instanceof OperatorApiError
          ? caughtError.message
          : "운영자 로그인에 실패했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className={styles.loginPanel} tone="outline">
      <div>
        <strong>운영자 로그인</strong>
        <p>Supabase에서 발급받은 OPERATOR 계정으로 로그인해 신청 목록을 조회하세요.</p>
      </div>
      <form className={styles.loginForm} onSubmit={handleSubmit}>
        <label>
          <span>이메일</span>
          <input
            autoComplete="username"
            onChange={(event) => setEmail(event.currentTarget.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label>
          <span>비밀번호</span>
          <input
            autoComplete="current-password"
            onChange={(event) => setPassword(event.currentTarget.value)}
            required
            type="password"
            value={password}
          />
        </label>
        <Button
          loading={isSubmitting}
          loadingLabel="로그인 중"
          size="medium"
          type="submit"
        >
          운영자 로그인
        </Button>
      </form>
      {error ? <p className={styles.loginError} role="alert">{error}</p> : null}
    </Card>
  );
}
