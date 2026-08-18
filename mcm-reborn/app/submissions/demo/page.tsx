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
  const { state } = await searchParams;
  const demoState = readDemoState(state);

  if (demoState === "normal") {
    redirect("/submissions/demo/analysis");
  }

  return <SubmissionStatusScreen state={demoState} />;
}
