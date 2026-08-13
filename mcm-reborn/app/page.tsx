import { HomeScreen } from "@/components/screens/entry-capture/HomeScreen";
import {
  type EntryPageProps,
  readEntrySearchParams,
} from "@/components/screens/entry-capture/page-state";

export default async function HomePage({ searchParams }: EntryPageProps) {
  const { state } = await readEntrySearchParams(searchParams);

  return <HomeScreen state={state} />;
}
