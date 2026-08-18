import { IntroScreen } from "@/components/screens/entry-capture/IntroScreen";
import { StartScreen } from "@/components/screens/entry-capture/StartScreen";
import {
  type EntryPageProps,
  readEntrySearchParams,
} from "@/components/screens/entry-capture/page-state";

export default async function LandingPage({ searchParams }: EntryPageProps) {
  const { state } = await readEntrySearchParams(searchParams);

  return state === "normal" ? <StartScreen /> : <IntroScreen state={state} />;
}
