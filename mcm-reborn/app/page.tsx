import { IntroScreen } from "@/components/screens/entry-capture/IntroScreen";
import { StartScreen } from "@/components/screens/entry-capture/StartScreen";
import {
  type EntryPageProps,
  readEntrySearchParams,
} from "@/components/screens/entry-capture/page-state";

export default async function LandingPage({ searchParams }: EntryPageProps) {
  const { bootstrapCustomer, state } = await readEntrySearchParams(searchParams);

  return state === "normal" ? (
    <StartScreen bootstrapCustomer={bootstrapCustomer} />
  ) : (
    <IntroScreen state={state} />
  );
}
