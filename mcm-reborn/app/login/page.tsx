import type { Metadata } from "next";
import { LoginScreen } from "@/components/screens/entry-capture/AuthScreens";
import {
  type EntryPageProps,
  readEntrySearchParams,
} from "@/components/screens/entry-capture/page-state";

export const metadata: Metadata = {
  title: "로그인",
};

export default async function LoginPage({ searchParams }: EntryPageProps) {
  const { state } = await readEntrySearchParams(searchParams);

  return <LoginScreen state={state} />;
}
