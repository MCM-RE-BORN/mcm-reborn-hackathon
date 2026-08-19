import type { Metadata } from "next";
import { RecommendationScreen } from "@/components/screens/analysis-design/RecommendationScreen";
import { readRecommendationCategory } from "@/components/screens/analysis-design/recommendation-catalog";
import { readDemoState } from "@/components/screens/analysis-design/types";

export const metadata: Metadata = {
  title: "추천 디자인",
};

type DesignsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DesignsPage({
  searchParams,
}: DesignsPageProps) {
  const { analysisId, category, state } = await searchParams;
  const resolvedAnalysisId = Array.isArray(analysisId)
    ? analysisId[0]
    : analysisId;

  return (
    <RecommendationScreen
      analysisId={resolvedAnalysisId}
      category={readRecommendationCategory(category)}
      state={readDemoState(state)}
    />
  );
}
