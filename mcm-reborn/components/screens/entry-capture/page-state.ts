import { firstValue } from "@/lib/search-params";

import {
  DEFAULT_CAPTURE_SLOT,
  isCaptureSlotId,
  type CaptureSlotId,
} from "./capture-config";

export type PageState =
  | "normal"
  | "loading"
  | "empty"
  | "error"
  | "permission"
  | "limited";

export type EntrySearchParams = Promise<{
  captured?: string | string[];
  completed?: string | string[];
  slot?: string | string[];
  state?: string | string[];
}>;

export type EntryPageProps = {
  searchParams: EntrySearchParams;
};

const PAGE_STATES = new Set<PageState>([
  "normal",
  "loading",
  "empty",
  "error",
  "permission",
  "limited",
]);

function readCapturedSlots(value: string | undefined) {
  if (!value) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .split(",")
        .filter((slot): slot is CaptureSlotId => isCaptureSlotId(slot)),
    ),
  );
}

export async function readEntrySearchParams(searchParams: EntrySearchParams) {
  const values = await searchParams;
  const requestedState = firstValue(values.state);
  const requestedSlot = firstValue(values.slot);
  const slot =
    requestedSlot && isCaptureSlotId(requestedSlot)
      ? requestedSlot
      : DEFAULT_CAPTURE_SLOT;
  const capturedSlots = readCapturedSlots(firstValue(values.completed));

  if (firstValue(values.captured) === "1" && !capturedSlots.length) {
    capturedSlots.push(slot);
  }

  return {
    captured: capturedSlots.length > 0,
    capturedSlots,
    slot,
    state:
      requestedState && PAGE_STATES.has(requestedState as PageState)
        ? (requestedState as PageState)
        : "normal",
  };
}
