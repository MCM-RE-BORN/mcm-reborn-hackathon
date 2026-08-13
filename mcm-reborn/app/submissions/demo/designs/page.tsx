import type { Metadata } from "next";
import { RecommendationScreen } from "@/components/screens/analysis-design/RecommendationScreen";
import {
  readDemoState,
  readRecommendationCategory,
} from "@/components/screens/analysis-design/types";

export const metadata: Metadata = {
  title: "추천 디자인",
};

type DesignsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DesignsPage({
  searchParams,
}: DesignsPageProps) {
  const { category, state } = await searchParams;

  return (
    <RecommendationScreen
      category={readRecommendationCategory(category)}
      state={readDemoState(state)}
    />
  );
}
