export const CAPTURE_SLOTS = [
  {
    id: "leftSide",
    label: "좌측면",
    className: "captureSlotHalf",
    guide: "제품의 좌측면 전체가 보이도록 맞춰주세요",
  },
  {
    id: "rightSide",
    label: "우측면",
    className: "captureSlotHalf",
    guide: "제품의 우측면 전체가 보이도록 맞춰주세요",
  },
  {
    id: "bottom",
    label: "하단",
    className: "captureSlotHalf",
    guide: "제품을 기울여 하단 전체가 보이도록 맞춰주세요",
  },
  {
    id: "rear",
    label: "후면",
    className: "captureSlotHalf",
    guide: "제품의 후면 전체가 보이도록 맞춰주세요",
  },
] as const;

export type CaptureSlotId = (typeof CAPTURE_SLOTS)[number]["id"];

export const DEFAULT_CAPTURE_SLOT: CaptureSlotId = "leftSide";
export const MIN_REQUIRED_CAPTURES = CAPTURE_SLOTS.length;

const CAPTURE_SLOT_IDS = new Set<CaptureSlotId>(
  CAPTURE_SLOTS.map((slot) => slot.id),
);

export function isCaptureSlotId(value: string): value is CaptureSlotId {
  return CAPTURE_SLOT_IDS.has(value as CaptureSlotId);
}

export function getCaptureSlot(slotId: CaptureSlotId) {
  return (
    CAPTURE_SLOTS.find((slot) => slot.id === slotId) ?? CAPTURE_SLOTS[0]
  );
}
