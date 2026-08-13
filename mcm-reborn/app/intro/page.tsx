import type { Metadata } from "next";
import { IntroScreen } from "@/components/screens/entry-capture/IntroScreen";
import {
  type EntryPageProps,
  readEntrySearchParams,
} from "@/components/screens/entry-capture/page-state";

export const metadata: Metadata = {
  title: "서비스 소개",
};

export default async function IntroPage({ searchParams }: EntryPageProps) {
  const { state } = await readEntrySearchParams(searchParams);

  return <IntroScreen state={state} />;
}
