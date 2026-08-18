import type { Metadata } from "next";
import { ProductCaptureScreen } from "@/components/screens/entry-capture/ProductCaptureScreen";
import {
  type EntryPageProps,
  readEntrySearchParams,
} from "@/components/screens/entry-capture/page-state";

export const metadata: Metadata = {
  title: "제품 사진 등록",
};

export default async function ProductNewPage({
  searchParams,
}: EntryPageProps) {
  const { capturedSlots, state } = await readEntrySearchParams(searchParams);

  return (
    <ProductCaptureScreen capturedSlots={capturedSlots} state={state} />
  );
}
