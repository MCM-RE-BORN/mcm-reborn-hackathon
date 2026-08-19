import type { Metadata } from "next";
import { AnalysisResultScreen } from "@/components/screens/analysis-design/AnalysisResultScreen";
import { readDemoState } from "@/components/screens/analysis-design/types";

export const metadata: Metadata = {
  title: "AI 분석 결과",
};

type AnalysisPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AnalysisPage({
  searchParams,
}: AnalysisPageProps) {
  const query = await searchParams;
  const { state } = query;
  const analysisId = Array.isArray(query.analysisId)
    ? query.analysisId[0]
    : query.analysisId;

  return <AnalysisResultScreen analysisId={analysisId} state={readDemoState(state)} />;
}
