import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SubmissionStatusScreen } from "@/components/screens/analysis-design/SubmissionStatusScreen";
import { readDemoState } from "@/components/screens/analysis-design/types";

export const metadata: Metadata = {
  title: "접수 현황",
};

type SubmissionPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SubmissionPage({
  searchParams,
}: SubmissionPageProps) {
  const query = await searchParams;
  const { state } = query;
  const analysisId = Array.isArray(query.analysisId)
    ? query.analysisId[0]
    : query.analysisId;
  const demoState = readDemoState(state);

  if (demoState === "normal") {
    redirect(
      analysisId
        ? `/submissions/demo/analysis?analysisId=${encodeURIComponent(analysisId)}`
        : "/submissions/demo/analysis",
    );
  }

  return <SubmissionStatusScreen analysisId={analysisId} state={demoState} />;
}
