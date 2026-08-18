"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { StatusPanel } from "@/components/ui/StatusPanel";

export function SubmissionLoadingState() {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      router.replace("/submissions/demo");
    }, 1600);

    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <StatusPanel
      action={
        <ButtonLink fullWidth href="/submissions/demo" variant="outline">
          분석 완료 결과 바로 보기
        </ButtonLink>
      }
      description="등록한 사진과 제품 정보를 바탕으로 상태와 예상 재활용 범위를 확인하고 있어요. 잠시 후 자동으로 결과가 열립니다."
      title="AI 사전 분석 중"
      tone="loading"
    />
  );
}
