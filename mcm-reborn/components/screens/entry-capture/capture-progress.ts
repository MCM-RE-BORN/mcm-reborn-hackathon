import { CAPTURE_SLOTS, type CaptureSlotId } from "./capture-config";
import type { CaptureAssets } from "./CaptureSessionProvider";

/**
 * 슬롯이 채워졌는지 판단하는 단일 기준.
 * 이번 세션에서 찍은 사진(captures)이거나, 이전 세션에서 찍어 쿼리로
 * 넘어온 슬롯(capturedSlots)이면 완료로 본다.
 */
export function isCaptureSlotCompleted(
  captures: CaptureAssets,
  capturedSlotSet: ReadonlySet<CaptureSlotId>,
  slotId: CaptureSlotId,
) {
  return Boolean(captures[slotId]) || capturedSlotSet.has(slotId);
}

export function completedCaptureSlotIds(
  captures: CaptureAssets,
  capturedSlots: CaptureSlotId[],
): CaptureSlotId[] {
  const capturedSlotSet = new Set(capturedSlots);
  return CAPTURE_SLOTS.filter((slot) =>
    isCaptureSlotCompleted(captures, capturedSlotSet, slot.id),
  ).map((slot) => slot.id);
}

export function captureCount(
  captures: CaptureAssets,
  capturedSlots: CaptureSlotId[],
) {
  return completedCaptureSlotIds(captures, capturedSlots).length;
}

/** 아직 비어 있는 첫 슬롯. 앨범에서 고른 사진을 넣을 자리를 정할 때 쓴다. */
export function nextEmptyCaptureSlot(
  captures: CaptureAssets,
  capturedSlots: CaptureSlotId[],
) {
  const capturedSlotSet = new Set(capturedSlots);
  return CAPTURE_SLOTS.find(
    (slot) => !isCaptureSlotCompleted(captures, capturedSlotSet, slot.id),
  );
}
