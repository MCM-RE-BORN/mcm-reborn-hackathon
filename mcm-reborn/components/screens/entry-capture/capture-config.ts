export const CAPTURE_SLOTS = [
  {
    id: "front",
    label: "정면",
    className: "captureSlotHero",
    guide: "제품 정면을 가이드 안에 맞춰주세요",
  },
  {
    id: "side",
    label: "측면",
    className: "captureSlotHalf",
    guide: "제품 측면이 잘 보이도록 맞춰주세요",
  },
  {
    id: "inside",
    label: "내부",
    className: "captureSlotHalf",
    guide: "가방 내부를 밝고 선명하게 촬영해주세요",
  },
  {
    id: "engraving",
    label: "각인",
    className: "captureSlotSerial",
    guide: "제품 각인이 선명하게 보이도록 맞춰주세요",
  },
] as const;

export type CaptureSlotId = (typeof CAPTURE_SLOTS)[number]["id"];

export const DEFAULT_CAPTURE_SLOT: CaptureSlotId = "front";
export const MIN_REQUIRED_CAPTURES = 3;

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
