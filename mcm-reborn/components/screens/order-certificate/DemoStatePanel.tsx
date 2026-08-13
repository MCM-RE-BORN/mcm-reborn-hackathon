import { ButtonLink } from "@/components/ui/Button";
import { StatusPanel, type StatusTone } from "@/components/ui/StatusPanel";
import type { DemoState } from "./demo-state";

type DemoStatePanelProps = {
  canceledDescription?: string;
  emptyDescription: string;
  lockedDescription?: string;
  permissionDescription?: string;
  retryHref: string;
  state: Exclude<DemoState, "normal" | "change-request">;
  subject: string;
};

const TONE_BY_STATE: Record<
  Exclude<DemoState, "normal" | "change-request">,
  StatusTone
> = {
  canceled: "empty",
  empty: "empty",
  error: "error",
  locked: "permission",
  loading: "loading",
  permission: "permission",
};

export function DemoStatePanel({
  canceledDescription = "사용자가 요청을 취소했습니다.",
  emptyDescription,
  lockedDescription = "이 정보는 앞선 단계가 완료된 뒤 확인할 수 있습니다.",
  permissionDescription = "로그인 상태와 접근 권한을 확인한 뒤 다시 시도해 주세요.",
  retryHref,
  state,
  subject,
}: DemoStatePanelProps) {
  const copy = {
    canceled: {
      description: canceledDescription,
      title: `${subject}이(가) 취소되었습니다`,
    },
    empty: {
      description: emptyDescription,
      title: `${subject}이(가) 없습니다`,
    },
    error: {
      description: "잠시 후 다시 시도해 주세요. 입력하거나 확인하던 내용은 유지됩니다.",
      title: `${subject}을(를) 불러오지 못했습니다`,
    },
    locked: {
      description: lockedDescription,
      title: `${subject}이(가) 아직 잠겨 있습니다`,
    },
    loading: {
      description: "데모 데이터를 안전하게 준비하고 있습니다.",
      title: `${subject}을(를) 불러오는 중입니다`,
    },
    permission: {
      description: permissionDescription,
      title: `${subject} 접근 권한이 필요합니다`,
    },
  }[state];

  return (
    <StatusPanel
      action={
        state === "error" ? (
          <ButtonLink fullWidth href={retryHref}>
            다시 시도
          </ButtonLink>
        ) : state === "canceled" ? (
          <ButtonLink fullWidth href="/">
            홈으로 돌아가기
          </ButtonLink>
        ) : state === "permission" ? (
          <ButtonLink fullWidth href="/login">
            로그인으로 이동
          </ButtonLink>
        ) : state === "locked" ? (
          <ButtonLink fullWidth href="/orders/demo">
            신청 내역 확인하기
          </ButtonLink>
        ) : undefined
      }
      description={copy.description}
      title={copy.title}
      tone={TONE_BY_STATE[state]}
    />
  );
}
