type CameraDeviceDescriptor = Pick<
  MediaDeviceInfo,
  "deviceId" | "kind" | "label"
>;

const FRONT_CAMERA_PATTERN =
  /\b(?:front|selfie|user)\b|전면|셀피|前置|前面|前方/;
const REAR_CAMERA_PATTERN =
  /\b(?:back|environment|rear)\b|후면|후방|背面|后置|後置|後方/;
const NON_ONE_X_CAMERA_PATTERN =
  /\b(?:depth|macro|periscope|tele|telephoto|ultra\s*wide|ultrawide)\b|망원|잠망경|접사|매크로|심도|초광각|長焦|长焦|望遠|超広角|超廣角|超广角/;
const MAGNIFICATION_PATTERN =
  /(?:^|\s)(\d+(?:\.\d+)?)\s*(?:x|배)(?:\s|$)/;
const PRIMARY_CAMERA_PATTERN =
  /\b(?:main|primary|standard|wide(?:\s+angle)?)\b|기본|표준|주\s*카메라|광각|广角|廣角|広角/;
const GENERIC_REAR_CAMERA_PATTERN =
  /^(?:(?:back|environment|rear)(?:\s+facing)?\s+camera|(?:후면|후방)\s+카메라)$/;
const ANDROID_PRIMARY_CAMERA_PATTERN =
  /\bcamera2?\s*0\b.*\b(?:back|rear)\b/;

function normalizeCameraLabel(label: string) {
  return label
    .normalize("NFKC")
    .toLowerCase()
    .replaceAll("×", "x")
    .replace(/[()[\]{},:/_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function oneXCameraScore(
  device: CameraDeviceDescriptor,
  currentDeviceId?: string,
) {
  if (
    device.kind !== "videoinput" ||
    !device.deviceId ||
    !device.label
  ) {
    return null;
  }

  const label = normalizeCameraLabel(device.label);
  const magnification = MAGNIFICATION_PATTERN.exec(label)?.[1];
  if (
    FRONT_CAMERA_PATTERN.test(label) ||
    NON_ONE_X_CAMERA_PATTERN.test(label) ||
    (magnification !== undefined && Number(magnification) !== 1) ||
    !REAR_CAMERA_PATTERN.test(label)
  ) {
    return null;
  }

  let score = 20;
  if (magnification !== undefined) {
    score += 100;
  }
  if (ANDROID_PRIMARY_CAMERA_PATTERN.test(label)) {
    score += 100;
  }
  if (PRIMARY_CAMERA_PATTERN.test(label)) {
    score += 70;
  }
  if (GENERIC_REAR_CAMERA_PATTERN.test(label)) {
    score += 60;
  }
  if (device.deviceId === currentDeviceId) {
    score += 1;
  }

  return score >= 80 ? score : null;
}

export function selectOneXCameraDevice<T extends CameraDeviceDescriptor>(
  devices: readonly T[],
  currentDeviceId?: string,
) {
  // Device labels are browser-defined and localized. Only select a device
  // when the label identifies both a rear camera and a main/1x lens.
  let selected: T | null = null;
  let selectedScore = -1;

  for (const device of devices) {
    const score = oneXCameraScore(device, currentDeviceId);
    if (score !== null && score > selectedScore) {
      selected = device;
      selectedScore = score;
    }
  }

  return selected;
}
