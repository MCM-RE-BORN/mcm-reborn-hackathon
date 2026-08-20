export const CAPTURE_SLOTS = [
  {
    id: "front",
    label: "정면",
    className: "captureSlotHalf",
    guide: "제품의 정면 전체가 보이도록 맞춰주세요",
  },
  {
    id: "rear",
    label: "후면",
    className: "captureSlotHalf",
    guide: "제품의 후면 전체가 보이도록 맞춰주세요",
  },
  {
    id: "top",
    label: "상단",
    className: "captureSlotHalf",
    guide: "제품을 기울여 상단 전체가 보이도록 맞춰주세요",
  },
  {
    id: "bottom",
    label: "하단",
    className: "captureSlotHalf",
    guide: "제품을 기울여 하단 전체가 보이도록 맞춰주세요",
  },
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
    id: "serialNumber",
    label: "시리얼 번호",
    className: "captureSlotSerial",
    guide: "제품의 시리얼 번호가 선명하게 보이도록 맞춰주세요",
  },
] as const;

export const GENERAL_CAPTURE_SLOTS = CAPTURE_SLOTS.filter(
  (slot) => slot.id !== "serialNumber",
);

export const DEMO_SERIAL_NUMBER = "MK123456789";

export type CaptureSlotId = (typeof CAPTURE_SLOTS)[number]["id"];

export const DEFAULT_CAPTURE_SLOT: CaptureSlotId = "front";
export const MIN_REQUIRED_CAPTURES = GENERAL_CAPTURE_SLOTS.length;

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
