import Image from "next/image";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { TextField } from "@/components/ui/TextField";
import type { PageState } from "./page-state";
import styles from "./entry-capture.module.css";

type AuthScreenProps = {
  state: PageState;
};

function AuthBrand() {
  return (
    <div className={styles.authBrand}>
      <Image
        alt="MCM"
        className={styles.authLogo}
        height={70}
        priority
        src="/assets/mvp-beta/brand-mcm-wing-logo.png"
        width={80}
      />
      <p>MCM RE:BORN</p>
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
          <ButtonLink fullWidth href="/">
            홈으로 이동
          </ButtonLink>
        }
        description="베타 세션이 이미 연결되어 있어 인증 화면 대신 홈을 이용할 수 있어요."
        title="이미 로그인한 상태예요"
        tone="permission"
      />
    );
  }

  return null;
}

export function LoginScreen({ state }: AuthScreenProps) {
  const statePanel = <AuthState kind="login" state={state} />;
  const hasError = state === "error";

  return (
    <AppShell header={<PageHeader backHref="/intro" />}>
      <div className={styles.authContent}>
        <AuthBrand />
        {statePanel || (
          <>
            <div className={styles.authHeading}>
              <h1>로그인</h1>
              <p>보유한 MCM 제품의 새로운 여정을 시작하세요.</p>
            </div>
            <form className={styles.authForm}>
              <TextField
                autoComplete="email"
                error={hasError ? "이메일 또는 비밀번호를 다시 확인해주세요." : undefined}
                id="login-email"
                label="이메일"
                placeholder="example@email.com"
                type="email"
              />
              <TextField
                autoComplete="current-password"
                id="login-password"
                label="비밀번호"
                placeholder="비밀번호를 입력해주세요"
                type="password"
              />
              {/* TODO(post-beta): connect login to the approved authentication contract. */}
              <ButtonLink fullWidth href="/">
                로그인
              </ButtonLink>
            </form>
            <nav aria-label="계정 도움말" className={styles.authLinks}>
              <Link href="/signup">회원가입</Link>
              <span aria-hidden="true" />
              <Link href="/login?state=permission">비밀번호 찾기</Link>
            </nav>
          </>
        )}
        <p className={styles.betaCaption}>
          베타 화면에서는 입력한 인증 정보를 저장하거나 전송하지 않습니다.
        </p>
      </div>
    </AppShell>
  );
}

export function SignupScreen({ state }: AuthScreenProps) {
  const statePanel = <AuthState kind="signup" state={state} />;
  const hasError = state === "error";

  return (
    <AppShell header={<PageHeader backHref="/login" />}>
      <div className={styles.authContent}>
        <AuthBrand />
        {statePanel || (
          <>
            <div className={styles.authHeading}>
              <h1>회원가입</h1>
              <p>필수 정보와 약관 동의를 확인해주세요.</p>
            </div>
            <form className={styles.authForm}>
              <TextField
                autoComplete="name"
                id="signup-name"
                label="이름"
                placeholder="이름을 입력해주세요"
                required
              />
              <TextField
                autoComplete="email"
                error={hasError ? "이미 가입된 이메일입니다." : undefined}
                id="signup-email"
                label="이메일"
                placeholder="example@email.com"
                required
                type="email"
              />
              <TextField
                autoComplete="tel"
                id="signup-phone"
                label="휴대전화"
                placeholder="010-0000-0000"
                required
                type="tel"
              />
              <TextField
                autoComplete="new-password"
                hint="영문, 숫자를 포함해 8자 이상 입력해주세요."
                id="signup-password"
                label="비밀번호"
                placeholder="비밀번호를 입력해주세요"
                required
                type="password"
              />
              <TextField
                autoComplete="new-password"
                id="signup-password-confirm"
                label="비밀번호 확인"
                placeholder="비밀번호를 한 번 더 입력해주세요"
                required
                type="password"
              />
              <fieldset className={styles.consentGroup}>
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
              {/* TODO(post-beta): connect signup, consent records, and duplicate-email validation. */}
              <ButtonLink fullWidth href="/">
                가입하기
              </ButtonLink>
            </form>
          </>
        )}
        <p className={styles.betaCaption}>
          베타 화면에서는 입력한 회원 정보를 저장하거나 전송하지 않습니다.
        </p>
      </div>
    </AppShell>
  );
}
