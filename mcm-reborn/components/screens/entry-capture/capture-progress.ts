import { CAPTURE_SLOTS, type CaptureSlotId } from "./capture-config";
import type { CaptureAssets } from "./CaptureSessionProvider";

export function captureCount(
  captures: CaptureAssets,
  capturedSlots: CaptureSlotId[],
) {
  const capturedSlotSet = new Set(capturedSlots);
  return CAPTURE_SLOTS.filter(
    (slot) => captures[slot.id] || capturedSlotSet.has(slot.id),
  ).length;
}
