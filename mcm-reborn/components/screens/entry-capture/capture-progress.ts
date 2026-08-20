import {
  CAPTURE_SLOTS,
  GENERAL_CAPTURE_SLOTS,
  type CaptureSlotId,
} from "./capture-config";
import type { CaptureAssets } from "./CaptureSessionProvider";

type CaptureSlot = (typeof CAPTURE_SLOTS)[number];

/**
 * 슬롯이 채워졌는지 판단하는 단일 기준.
 * 이번 세션에서 찍은 사진(captures)이거나, 이전 세션에서 찍어 쿼리로
 * 넘어온 슬롯(capturedSlotSet)이면 완료로 본다.
 *
 * validate_package.py가 이 표현식을 'session-or-query completion' 계약으로
 * 검사하므로 형태를 바꿀 때는 검증기도 함께 갱신해야 한다.
 */
export function isCaptureSlotCompleted(
  captures: CaptureAssets,
  capturedSlotSet: ReadonlySet<CaptureSlotId>,
  slot: CaptureSlot,
) {
  return Boolean(captures[slot.id] || capturedSlotSet.has(slot.id));
}

export function completedCaptureSlotIds(
  captures: CaptureAssets,
  capturedSlots: CaptureSlotId[],
): CaptureSlotId[] {
  const capturedSlotSet = new Set(capturedSlots);
  return CAPTURE_SLOTS.filter((slot) =>
    isCaptureSlotCompleted(captures, capturedSlotSet, slot),
  ).map((slot) => slot.id);
}

export function captureCount(
  captures: CaptureAssets,
  capturedSlots: CaptureSlotId[],
) {
  const capturedSlotSet = new Set(capturedSlots);
  return GENERAL_CAPTURE_SLOTS.filter((slot) =>
    isCaptureSlotCompleted(captures, capturedSlotSet, slot),
  ).length;
}

/** 아직 비어 있는 첫 필수 슬롯. 앨범 사진은 일반 6면 슬롯에만 넣는다. */
export function nextEmptyCaptureSlot(
  captures: CaptureAssets,
  capturedSlots: CaptureSlotId[],
) {
  const capturedSlotSet = new Set(capturedSlots);
  return GENERAL_CAPTURE_SLOTS.find(
    (slot) => !isCaptureSlotCompleted(captures, capturedSlotSet, slot),
  );
}
