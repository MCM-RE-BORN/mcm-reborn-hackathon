import type { Metadata } from "next";
import { SignupScreen } from "@/components/screens/entry-capture/AuthScreens";
import {
  type EntryPageProps,
  readEntrySearchParams,
} from "@/components/screens/entry-capture/page-state";

export const metadata: Metadata = {
  title: "회원가입",
};

export default async function SignupPage({ searchParams }: EntryPageProps) {
  const { state } = await readEntrySearchParams(searchParams);

  return <SignupScreen state={state} />;
}
