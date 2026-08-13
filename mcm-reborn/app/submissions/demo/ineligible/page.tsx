import type { Metadata } from "next";
import { AnalysisResultScreen } from "@/components/screens/analysis-design/AnalysisResultScreen";
import { readDemoState } from "@/components/screens/analysis-design/types";

export const metadata: Metadata = {
  title: "제작 불가 안내",
};

type IneligiblePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function IneligiblePage({
  searchParams,
}: IneligiblePageProps) {
  const { state } = await searchParams;

  return (
    <AnalysisResultScreen ineligible state={readDemoState(state)} />
  );
}

