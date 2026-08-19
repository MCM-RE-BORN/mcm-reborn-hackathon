"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { TextField } from "@/components/ui/TextField";
import type { PageState } from "./page-state";
import styles from "./entry-capture.module.css";
import { SignupEmailField } from "./SignupEmailField";
import { SignupPasswordField } from "./SignupPasswordField";
import { SignupPhoneField } from "./SignupPhoneField";
import { loginCustomerCredentials } from "../order-certificate/customer-client";

type AuthScreenProps = {
  state: PageState;
};

type AuthBrandProps = {
  expanded?: boolean;
  subtitle?: ReactNode;
};

function AuthBrand({ expanded = false, subtitle }: AuthBrandProps) {
  const brandClassName = [styles.authBrand, expanded ? styles.authBrandExpanded : ""]
    .filter(Boolean)
    .join(" ");
  const logoClassName = [styles.authLogo, expanded ? styles.authLogoExpanded : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={brandClassName}>
      <Image
        alt="MCM"
        className={logoClassName}
        height={expanded ? 116 : 70}
        priority
        src="/assets/mvp-beta/brand-mcm-wing-logo.png"
        width={expanded ? 132 : 80}
      />
      <div className={styles.authBrandCopy}>
        <p className={expanded ? styles.authBrandTitle : undefined}>MCM RE:BORN</p>
        {subtitle ? <p className={styles.authBrandSubtitle}>{subtitle}</p> : null}
      </div>
    </div>
  );
}

function AuthState({ kind, state }: { kind: "login" | "signup"; state: PageState }) {
  if (state === "loading") {
    return (
      <StatusPanel
        description={kind === "login" ? "로그인 화면을 준비하고 있어요." : "가입 화면을 준비하고 있어요."}
        title="잠시만 기다려주세요"
        tone="loading"
      />
    );
  }

  if (state === "permission") {
    return (
      <StatusPanel
        action={
          <ButtonLink fullWidth href="/home">
            홈으로 이동
          </ButtonLink>
        }
        description="이미 로그인되어 있어 인증 화면 대신 홈을 이용할 수 있어요."
        title="이미 로그인한 상태예요"
        tone="permission"
      />
    );
  }

  if (state === "empty" || state === "limited") {
    return (
      <StatusPanel
        action={
          <ButtonLink fullWidth href="/intro" variant="outline">
            서비스 소개로 돌아가기
          </ButtonLink>
        }
        description="현재 세션에서는 이 인증 화면을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요."
        title="인증 화면 이용이 제한되어 있어요"
        tone="permission"
      />
    );
  }

  return null;
}

export function LoginScreen({ state }: AuthScreenProps) {
  const router = useRouter();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasError = state === "error" || loginError !== null;
  const showForm = state === "normal" || hasError;
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    setLoginError(null);
    setIsSubmitting(true);
    try {
      await loginCustomerCredentials(email, password);
      router.push("/home");
    } catch (error) {
      setLoginError(
        error instanceof Error
          ? error.message
          : "아이디 또는 비밀번호를 다시 확인해주세요.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className={`${styles.authContent} ${styles.authContentLogin}`}>
        <h1 className={styles.visuallyHidden}>로그인</h1>
        <AuthBrand expanded subtitle="MODERN CREATION, REBORN" />
        {showForm ? (
          <>
            <form
              className={`${styles.authForm} ${styles.authFormTight}`}
              method="post"
              onSubmit={handleSubmit}
            >
              <TextField
                autoComplete="username"
                error={hasError ? loginError ?? "아이디 또는 비밀번호를 다시 확인해주세요." : undefined}
                hideLabel
                id="login-id"
                label="아이디"
                name="email"
                placeholder="아이디 입력"
                required
                type="text"
              />
              <TextField
                autoComplete="current-password"
                hideLabel
                id="login-password"
                label="비밀번호"
                name="password"
                placeholder="비밀번호 입력"
                required
                type="password"
              />
              <button
                className={styles.authSubmit}
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "로그인 중..." : "로그인"}
              </button>
            </form>
            <nav aria-label="계정 도움말" className={styles.authLinks}>
              <Link href="/login?state=limited">아이디 찾기</Link>
              <span aria-hidden="true" />
              <Link href="/login?state=limited">비밀번호 찾기</Link>
              <span aria-hidden="true" />
              <Link href="/signup">회원가입</Link>
            </nav>
          </>
        ) : (
          <AuthState kind="login" state={state} />
        )}
        <p className={styles.betaCaption}>
          입력한 인증 정보는 Supabase Auth로 안전하게 확인합니다.
        </p>
      </div>
    </AppShell>
  );
}

export function SignupScreen({ state }: AuthScreenProps) {
  const router = useRouter();
  const hasError = state === "error";
  const showForm = state === "normal" || hasError;
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // 회원가입은 현재 데모 폼이며 실제 Auth 세션을 만들지 않으므로,
    // 인증되지 않은 사용자를 홈으로 보내지 않고 로그인 화면으로 돌려보낸다.
    router.replace("/login");
  };

  return (
    <AppShell header={<PageHeader backHref="/login" title="회원가입" />}>
      <div className={styles.authContent}>
        {showForm ? (
          <form
            className={styles.authForm}
            method="post"
            onSubmit={handleSubmit}
          >
            <TextField
              autoComplete="name"
              density="compact"
              id="signup-name"
              label="이름"
              placeholder="이름을 입력해주세요"
              required
            />
            <SignupEmailField hasError={hasError} />
            <SignupPhoneField />
            <SignupPasswordField />
            <TextField
              autoComplete="new-password"
              density="compact"
              id="signup-password-confirm"
              label="비밀번호 확인"
              placeholder="비밀번호를 한 번 더 입력해주세요"
              required
              type="password"
            />
            <fieldset
              className={`${styles.consentGroup} ${styles.consentGroupSpacing}`}
            >
              <legend>약관 동의</legend>
              <label>
                <input required type="checkbox" />
                <span>[필수] 서비스 이용약관 및 개인정보 처리 동의</span>
              </label>
              <label>
                <input type="checkbox" />
                <span>[선택] 마케팅 정보 수신 동의</span>
              </label>
            </fieldset>
            {/* TODO(integration): connect signup, consent records, and duplicate-email validation. */}
            <button className={styles.authSubmit} type="submit">
              가입하기
            </button>
          </form>
        ) : (
          <AuthState kind="signup" state={state} />
        )}
        <p className={styles.betaCaption}>
          이 시연에서는 입력한 회원 정보를 저장하거나 전송하지 않습니다.
        </p>
      </div>
    </AppShell>
  );
}
