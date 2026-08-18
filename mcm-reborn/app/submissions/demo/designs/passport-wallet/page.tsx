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
  const { state } = await searchParams;

  return <MockupDetailScreen state={readDemoState(state)} />;
}
