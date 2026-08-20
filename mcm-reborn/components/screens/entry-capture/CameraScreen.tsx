"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button, ButtonLink } from "@/components/ui/Button";
import { LoadingIndicator } from "@/components/ui/LoadingIndicator";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { selectOneXCameraDevice } from "./camera-device-selection";
import {
  CAPTURE_SLOTS,
  GENERAL_CAPTURE_SLOTS,
  getCaptureSlot,
  type CaptureSlotId,
} from "./capture-config";
import { useCaptureSession } from "./CaptureSessionProvider";
import {
  captureVisibleVideoFrame,
  normalizeSelectedImage,
} from "./image-processing";
import type { PageState } from "./page-state";
import styles from "./entry-capture.module.css";

type CameraScreenProps = {
  completedSlots: CaptureSlotId[];
  slot: CaptureSlotId;
  state: PageState;
};

type CameraRuntimeState =
  | "starting"
  | "ready"
  | "permission"
  | "empty"
  | "unsupported"
  | "error";

type CaptureDraft = {
  blob: Blob;
  fileName: string;
  previewUrl: string;
};

type CameraTrackCapabilities = MediaTrackCapabilities & {
  zoom?: MediaSettingsRange;
};

type CameraTrackConstraints = MediaTrackConstraints & {
  zoom?: ConstrainDouble;
};

const CAMERA_RESOLUTION_CONSTRAINTS: MediaTrackConstraints = {
  height: { ideal: 1080 },
  width: { ideal: 1920 },
};
const ONE_X_ZOOM = 1;

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function errorName(error: unknown) {
  return error instanceof DOMException ? error.name : "";
}

async function requestRearCameraStream() {
  let stream: MediaStream;

  try {
    // Select a rear camera before asking for a resolution. Including the
    // resolution in this request lets some multi-lens devices satisfy the
    // request with a telephoto source instead of the default 1x source.
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { exact: "environment" } },
    });
  } catch (error) {
    if (errorName(error) !== "OverconstrainedError") {
      throw error;
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
    } catch (fallbackError) {
      if (errorName(fallbackError) !== "OverconstrainedError") {
        throw fallbackError;
      }

      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: true,
      });
    }
  }

  return stream;
}

async function configureCameraStream(stream: MediaStream) {
  const track = stream.getVideoTracks()[0];
  if (!track) {
    return;
  }

  // Resolution is applied after the physical source has been selected so it
  // cannot influence which rear lens is opened.
  try {
    await track.applyConstraints(CAMERA_RESOLUTION_CONSTRAINTS);
  } catch {
    // Keep the usable native-resolution stream when a driver rejects hints.
  }

  let capabilities: CameraTrackCapabilities;
  try {
    capabilities = track.getCapabilities() as CameraTrackCapabilities;
  } catch {
    return;
  }

  const zoom = capabilities.zoom;
  if (
    typeof zoom?.min !== "number" ||
    typeof zoom.max !== "number" ||
    zoom.min > ONE_X_ZOOM ||
    zoom.max < ONE_X_ZOOM
  ) {
    return;
  }

  try {
    await track.applyConstraints({
      ...CAMERA_RESOLUTION_CONSTRAINTS,
      zoom: { exact: ONE_X_ZOOM },
    } as CameraTrackConstraints);
  } catch {
    // Zoom is optional in browsers without Image Capture/PTZ permission.
  }
}

async function preferOneXCameraStream(stream: MediaStream) {
  if (typeof navigator.mediaDevices.enumerateDevices !== "function") {
    return stream;
  }

  let devices: MediaDeviceInfo[];
  try {
    devices = await navigator.mediaDevices.enumerateDevices();
  } catch {
    return stream;
  }

  const currentTrack = stream.getVideoTracks()[0];
  const currentDeviceId =
    currentTrack?.getSettings().deviceId ??
    devices.find(
      (device) =>
        device.kind === "videoinput" && device.label === currentTrack?.label,
    )?.deviceId;
  const oneXDevice = selectOneXCameraDevice(devices, currentDeviceId);

  if (!oneXDevice || oneXDevice.deviceId === currentDeviceId) {
    return stream;
  }

  stopStream(stream);
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { deviceId: { exact: oneXDevice.deviceId } },
    });
  } catch {
    // A stale or browser-private device ID must not break camera access.
    return requestRearCameraStream();
  }
}

async function requestCameraStream() {
  const initialStream = await requestRearCameraStream();
  const stream = await preferOneXCameraStream(initialStream);
  await configureCameraStream(stream);
  return stream;
}

function captureFileName(slot: CaptureSlotId) {
  return `mcm-${slot}-${Date.now()}.jpg`;
}

function productCaptureHref(
  completedSlots: CaptureSlotId[],
  currentSlot: CaptureSlotId,
) {
  if (!completedSlots.length) {
    return "/products/new";
  }

  return `/products/new?captured=1&slot=${currentSlot}&completed=${completedSlots.join(",")}`;
}

function cameraHref(
  slot: CaptureSlotId,
  completedSlots: CaptureSlotId[],
) {
  const completedQuery = completedSlots.length
    ? `&completed=${completedSlots.join(",")}`
    : "";
  return `/products/new/camera?slot=${slot}${completedQuery}`;
}

type ForcedCameraStateProps = {
  completedSlots: CaptureSlotId[];
  slot: CaptureSlotId;
  state: Exclude<PageState, "normal">;
};

function ForcedCameraState({
  completedSlots,
  slot,
  state,
}: ForcedCameraStateProps) {
  const isPermission = state === "permission";
  const isLoading = state === "loading";
  const isEmpty = state === "empty";
  const isLimited = state === "limited";

  return (
    <div className={styles.cameraState}>
      <StatusPanel
        action={
          <ButtonLink
            fullWidth
            href={
              isPermission
                ? productCaptureHref(completedSlots, slot)
                : cameraHref(slot, completedSlots)
            }
            variant="outline"
          >
            {isPermission ? "제품 등록으로 돌아가기" : "다시 시도하기"}
          </ButtonLink>
        }
        description={
          isLoading
            ? "기기의 카메라 연결 상태를 확인하고 있어요."
            : isPermission
              ? "브라우저 설정에서 카메라 접근을 허용한 뒤 다시 시도해주세요."
              : isEmpty
                ? "사용 가능한 카메라를 찾지 못했어요. 제품 등록 화면에서 사진을 선택할 수 있어요."
                : isLimited
                  ? "이 기기에서는 카메라를 바로 열 수 없어요. 제품 등록 화면에서 사진을 선택해주세요."
                  : "카메라 화면을 준비하지 못했어요. 잠시 후 다시 시도해주세요."
        }
        title={
          isLoading
            ? "카메라를 준비하는 중"
            : isPermission
              ? "카메라 권한이 필요해요"
              : isEmpty
                ? "사용 가능한 카메라가 없어요"
                : isLimited
                  ? "카메라를 바로 열 수 없어요"
                  : "카메라를 열지 못했어요"
        }
        tone={
          isLoading
            ? "loading"
            : isPermission
              ? "permission"
              : isEmpty
                ? "empty"
                : "error"
        }
      />
    </div>
  );
}

type RuntimeCameraStateProps = {
  description?: string;
  isProcessing: boolean;
  onChooseFile: () => void;
  onRetry: () => void;
  runtimeState: Exclude<CameraRuntimeState, "ready">;
};

function RuntimeCameraState({
  description,
  isProcessing,
  onChooseFile,
  onRetry,
  runtimeState,
}: RuntimeCameraStateProps) {
  const isStarting = runtimeState === "starting";
  const isPermission = runtimeState === "permission";
  const isEmpty = runtimeState === "empty";
  const isUnsupported = runtimeState === "unsupported";

  const defaultDescription = isStarting
    ? "후면 카메라를 연결하고 있어요."
    : isPermission
      ? "브라우저 설정에서 카메라 접근을 허용하거나 기기 카메라로 촬영해주세요."
      : isEmpty
        ? "사용 가능한 카메라를 찾지 못했어요. 기기 카메라나 앨범의 사진을 선택해주세요."
        : isUnsupported
          ? "안전한 연결에서 다시 열거나 기기 카메라로 사진을 선택해주세요."
          : "카메라가 다른 앱에서 사용 중일 수 있어요. 잠시 후 다시 시도해주세요.";

  return (
    <div className={styles.cameraState}>
      <StatusPanel
        action={
          <div className={styles.cameraStatusActions}>
            {!isStarting && !isUnsupported ? (
              <Button
                disabled={isProcessing}
                fullWidth
                onClick={onRetry}
                variant="outline"
              >
                카메라 다시 시도
              </Button>
            ) : null}
            <Button
              fullWidth
              loading={isProcessing}
              loadingLabel="사진 준비 중"
              onClick={onChooseFile}
              variant={isStarting ? "outline" : "primary"}
            >
              기기에서 사진 선택
            </Button>
          </div>
        }
        description={description ?? defaultDescription}
        title={
          isStarting
            ? "카메라를 준비하는 중"
            : isPermission
              ? "카메라 권한이 필요해요"
              : isEmpty
                ? "사용 가능한 카메라가 없어요"
                : isUnsupported
                  ? "카메라를 바로 열 수 없어요"
                  : "카메라를 열지 못했어요"
        }
        tone={
          isStarting
            ? "loading"
            : isPermission
              ? "permission"
              : isEmpty
                ? "empty"
                : "error"
        }
      />
    </div>
  );
}

export function CameraScreen({
  completedSlots,
  slot,
  state,
}: CameraScreenProps) {
  const router = useRouter();
  const { captures, setCapture } = useCaptureSession();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const draftUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<CaptureDraft | null>(null);
  const [runtimeState, setRuntimeState] =
    useState<CameraRuntimeState>("starting");
  const [runtimeDescription, setRuntimeDescription] = useState<string>();
  const [retryKey, setRetryKey] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const slotConfig = getCaptureSlot(slot);
  const slotIndex = GENERAL_CAPTURE_SLOTS.findIndex(
    (item) => item.id === slot,
  );

  const stopCurrentStream = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const replaceDraft = useCallback(
    (blob: Blob, fileName: string) => {
      if (draftUrlRef.current) {
        URL.revokeObjectURL(draftUrlRef.current);
      }

      const previewUrl = URL.createObjectURL(blob);
      draftUrlRef.current = previewUrl;
      setDraft({ blob, fileName, previewUrl });
    },
    [],
  );

  const clearDraft = useCallback(() => {
    if (draftUrlRef.current) {
      URL.revokeObjectURL(draftUrlRef.current);
      draftUrlRef.current = null;
    }

    setDraft(null);
  }, []);

  useEffect(() => {
    if (state !== "normal" || draft) {
      return;
    }

    let cancelled = false;

    async function openCamera() {
      setRuntimeDescription(undefined);

      if (!navigator.mediaDevices?.getUserMedia) {
        setRuntimeState("unsupported");
        return;
      }

      try {
        const stream = await requestCameraStream();

        if (cancelled) {
          stopStream(stream);
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;

        if (!video) {
          stopCurrentStream();
          setRuntimeState("error");
          return;
        }

        video.srcObject = stream;
        await video.play();

        if (!cancelled) {
          setRuntimeState("ready");
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        stopCurrentStream();
        const name = errorName(error);
        setRuntimeState(
          name === "NotAllowedError" || name === "SecurityError"
            ? "permission"
            : name === "NotFoundError"
              ? "empty"
              : "error",
        );
      }
    }

    const handlePageHide = () => stopCurrentStream();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopCurrentStream();
        return;
      }

      setRuntimeState("starting");
      setRetryKey((value) => value + 1);
    };

    void openCamera();
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopCurrentStream();
    };
  }, [draft, retryKey, state, stopCurrentStream]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (draftUrlRef.current) {
        URL.revokeObjectURL(draftUrlRef.current);
      }
    };
  }, []);

  const handleRetry = () => {
    stopCurrentStream();
    setRuntimeDescription(undefined);
    setRuntimeState("starting");
    setRetryKey((value) => value + 1);
  };

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video || runtimeState !== "ready" || isCapturing) {
      return;
    }

    setIsCapturing(true);
    setRuntimeDescription(undefined);

    try {
      const blob = await captureVisibleVideoFrame(video);

      if (!mountedRef.current) {
        return;
      }

      stopCurrentStream();
      replaceDraft(blob, captureFileName(slot));
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      stopCurrentStream();
      setRuntimeDescription(
        error instanceof Error
          ? error.message
          : "사진을 촬영하지 못했습니다. 다시 시도해주세요.",
      );
      setRuntimeState("error");
    } finally {
      if (mountedRef.current) {
        setIsCapturing(false);
      }
    }
  };

  const handleFallbackSelection = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    setIsCapturing(true);
    setRuntimeDescription(undefined);

    try {
      const blob = await normalizeSelectedImage(file);

      if (!mountedRef.current) {
        return;
      }

      stopCurrentStream();
      replaceDraft(blob, captureFileName(slot));
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setRuntimeDescription(
        error instanceof Error
          ? error.message
          : "사진을 읽지 못했습니다. 다른 사진을 선택해주세요.",
      );
      setRuntimeState("error");
    } finally {
      if (mountedRef.current) {
        setIsCapturing(false);
      }
    }
  };

  const handleRetake = () => {
    clearDraft();
    setRuntimeDescription(undefined);
    setRuntimeState("starting");
  };

  const handleConfirm = () => {
    if (!draft) {
      return;
    }

    setCapture(slot, draft.blob, draft.fileName);
    const nextCompletedSlots = CAPTURE_SLOTS.filter(
      (captureSlot) =>
        captureSlot.id === slot ||
        Boolean(captures[captureSlot.id]) ||
        completedSlots.includes(captureSlot.id),
    ).map((captureSlot) => captureSlot.id);
    router.replace(productCaptureHref(nextCompletedSlots, slot));
  };

  return (
    <AppShell
      contentClassName={styles.cameraContent}
      contentWidth="full"
      immersive
    >
      <h1 className={styles.visuallyHidden}>제품 사진 촬영</h1>
      {state === "normal" && !draft ? (
        <video
          aria-label={`${slotConfig.label} 촬영을 위한 실시간 카메라 화면`}
          autoPlay
          className={styles.cameraVideo}
          muted
          playsInline
          ref={videoRef}
        />
      ) : null}

      {draft ? (
        <Image
          alt={`${slotConfig.label} 촬영 미리보기`}
          className={styles.cameraCapturedPreview}
          fill
          priority
          sizes="(max-width: 402px) 100vw, 402px"
          src={draft.previewUrl}
          unoptimized
        />
      ) : null}

      <div aria-hidden="true" className={styles.cameraScrim} />

      <Link
        aria-label="제품 사진 등록으로 돌아가기"
        className={styles.cameraBack}
        href={productCaptureHref(completedSlots, slot)}
        onClick={stopCurrentStream}
      >
        <Image
          alt=""
          aria-hidden="true"
          height={13}
          loading="eager"
          src="/assets/mvp-beta/icon-back.svg"
          width={15}
        />
      </Link>

      {state !== "normal" ? (
        <ForcedCameraState
          completedSlots={completedSlots}
          slot={slot}
          state={state}
        />
      ) : draft ? (
        <>
          <div className={styles.cameraGuideCopy}>
            <p>{slotConfig.label} 사진을 확인해주세요</p>
            <span>흔들리거나 잘린 부분이 없다면 이 사진을 사용해주세요.</span>
          </div>
          <div className={styles.cameraReviewActions}>
            <Button fullWidth onClick={handleRetake} variant="outline">
              다시 촬영
            </Button>
            <Button fullWidth onClick={handleConfirm}>
              이 사진 사용
            </Button>
          </div>
        </>
      ) : runtimeState === "ready" ? (
        <>
          <div className={styles.cameraGuideCopy}>
            <p>{slotConfig.guide}</p>
            <span>밝은 곳에서 제품 전체가 보이도록 촬영해주세요.</span>
          </div>

          <div className={styles.cameraGuide} aria-hidden="true">
            <Image
              alt=""
              fill
              priority
              sizes="287px"
              src="/assets/mvp-beta/camera-detection-outline.svg"
            />
          </div>

          <div className={styles.cameraControls}>
            <span>{slotConfig.label}</span>
            <button
              aria-label={`${slotConfig.label} 사진 촬영`}
              aria-busy={isCapturing || undefined}
              className={styles.cameraShutter}
              disabled={isCapturing}
              onClick={() => void handleCapture()}
              type="button"
            >
              <Image
                alt=""
                aria-hidden="true"
                fill
                sizes="66px"
                src="/assets/mvp-beta/camera-shutter-ring.svg"
              />
              <Image
                alt=""
                aria-hidden="true"
                fill
                sizes="52px"
                src="/assets/mvp-beta/camera-shutter-background.svg"
              />
              {isCapturing ? (
                <LoadingIndicator className={styles.cameraShutterLoading} />
              ) : null}
            </button>
            <span>
              {slot === "serialNumber"
                ? "선택"
                : `${slotIndex + 1} / ${GENERAL_CAPTURE_SLOTS.length}`}
            </span>
          </div>
        </>
      ) : (
        <RuntimeCameraState
          description={runtimeDescription}
          isProcessing={isCapturing}
          onChooseFile={() => fallbackInputRef.current?.click()}
          onRetry={handleRetry}
          runtimeState={runtimeState}
        />
      )}

      <input
        accept="image/jpeg,image/png"
        capture="environment"
        hidden
        onChange={(event) => void handleFallbackSelection(event)}
        ref={fallbackInputRef}
        type="file"
      />
    </AppShell>
  );
}
