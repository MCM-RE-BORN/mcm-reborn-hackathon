import type { Metadata } from "next";
import { CameraScreen } from "@/components/screens/entry-capture/CameraScreen";
import {
  type EntryPageProps,
  readEntrySearchParams,
} from "@/components/screens/entry-capture/page-state";

export const metadata: Metadata = {
  title: "제품 촬영",
};

export default async function ProductCameraPage({
  searchParams,
}: EntryPageProps) {
  const { capturedSlots, slot, state } =
    await readEntrySearchParams(searchParams);

  return (
    <CameraScreen completedSlots={capturedSlots} slot={slot} state={state} />
  );
}
