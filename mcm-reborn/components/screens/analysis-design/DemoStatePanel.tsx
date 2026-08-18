import { ButtonLink } from "@/components/ui/Button";
import { StatusPanel, type StatusTone } from "@/components/ui/StatusPanel";
import type { DemoState } from "./types";

type DemoStatePanelProps = {
  actionHref: string;
  actionLabel: string;
  context: "submission" | "analysis" | "recommendation" | "mockup";
  state: Exclude<DemoState, "normal">;
};

type StateCopy = {
  description: string;
  title: string;
  tone: StatusTone;
};

const CONTEXT_LABEL = {
  submission: "접수 내역",
  analysis: "분석 결과",
  recommendation: "추천 디자인",
  mockup: "3D 목업",
} as const;

const STATE_COPY: Record<Exclude<DemoState, "normal">, StateCopy> = {
  loading: {
    title: "정보를 불러오고 있어요",
    description: "잠시만 기다려 주세요. 요청한 정보가 곧 표시됩니다.",
    tone: "loading",
  },
  empty: {
    title: "표시할 정보가 없어요",
    description: "새 제품을 등록하면 이 단계의 정보를 확인할 수 있습니다.",
    tone: "empty",
  },
  error: {
    title: "정보를 불러오지 못했어요",
    description: "연결 상태를 확인한 뒤 다시 시도해 주세요.",
    tone: "error",
  },
  permission: {
    title: "이 화면을 볼 권한이 필요해요",
    description: "로그인 상태를 확인한 뒤 다시 시도해 주세요.",
    tone: "permission",
  },
  limited: {
    title: "다음 단계로 진행하기 어려워요",
    description: "현재 분석 조건에서는 제작 가능한 추천안을 제공할 수 없습니다.",
    tone: "permission",
  },
  canceled: {
    title: "접수가 취소되었어요",
    description: "취소된 접수는 분석과 제작 단계로 진행되지 않습니다.",
    tone: "permission",
  },
};

export function DemoStatePanel({
  actionHref,
  actionLabel,
  context,
  state,
}: DemoStatePanelProps) {
  const copy = STATE_COPY[state];
  const contextLabel = CONTEXT_LABEL[context];

  return (
    <StatusPanel
      action={
        <ButtonLink fullWidth href={actionHref}>
          {actionLabel}
        </ButtonLink>
      }
      description={`${contextLabel}: ${copy.description}`}
      title={copy.title}
      tone={copy.tone}
    />
  );
}
