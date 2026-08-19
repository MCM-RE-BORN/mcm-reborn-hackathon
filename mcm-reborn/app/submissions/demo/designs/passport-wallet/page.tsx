import type { Metadata } from "next";
import { MockupDetailScreen } from "@/components/screens/analysis-design/MockupDetailScreen";
import { readDemoState } from "@/components/screens/analysis-design/types";

export const metadata: Metadata = {
  title: "3D 목업 미리보기",
};

type MockupPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MockupPage({ searchParams }: MockupPageProps) {
  const { analysisId, productId, state } = await searchParams;
  const resolvedAnalysisId = Array.isArray(analysisId) ? analysisId[0] : analysisId;
  const resolvedProductId = Array.isArray(productId) ? productId[0] : productId;

  return (
    <MockupDetailScreen
      analysisId={resolvedAnalysisId}
      productId={resolvedProductId}
      state={readDemoState(state)}
    />
  );
}
