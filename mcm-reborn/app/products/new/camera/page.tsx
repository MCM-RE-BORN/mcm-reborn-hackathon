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
  const { state } = await readEntrySearchParams(searchParams);

  return <CameraScreen state={state} />;
}
