const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_CAPTURE_EDGE = 1600;
const JPEG_QUALITY = 0.86;

function canvasToJpeg(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("사진 데이터를 만들지 못했습니다."));
      },
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const sourceUrl = URL.createObjectURL(file);
    const image = new window.Image();

    image.onload = () => {
      URL.revokeObjectURL(sourceUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(sourceUrl);
      reject(new Error("선택한 사진을 읽지 못했습니다."));
    };
    image.src = sourceUrl;
  });
}

export async function captureVisibleVideoFrame(video: HTMLVideoElement) {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;

  if (!sourceWidth || !sourceHeight) {
    throw new Error("카메라 영상이 아직 준비되지 않았습니다.");
  }

  const viewportWidth = video.clientWidth || sourceWidth;
  const viewportHeight = video.clientHeight || sourceHeight;
  const sourceRatio = sourceWidth / sourceHeight;
  const viewportRatio = viewportWidth / viewportHeight;
  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  let cropX = 0;
  let cropY = 0;

  if (sourceRatio > viewportRatio) {
    cropWidth = sourceHeight * viewportRatio;
    cropX = (sourceWidth - cropWidth) / 2;
  } else if (sourceRatio < viewportRatio) {
    cropHeight = sourceWidth / viewportRatio;
    cropY = (sourceHeight - cropHeight) / 2;
  }

  const scale = Math.min(1, MAX_CAPTURE_EDGE / Math.max(cropWidth, cropHeight));
  const outputWidth = Math.max(1, Math.round(cropWidth * scale));
  const outputHeight = Math.max(1, Math.round(cropHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("이 브라우저에서는 사진을 처리할 수 없습니다.");
  }

  canvas.width = outputWidth;
  canvas.height = outputHeight;
  context.drawImage(
    video,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  return canvasToJpeg(canvas);
}

export async function normalizeSelectedImage(file: File) {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error("JPG 또는 PNG 사진만 선택할 수 있습니다.");
  }

  if (file.size > MAX_FILE_BYTES) {
    throw new Error("사진 한 장의 용량은 10MB 이하여야 합니다.");
  }

  const image = await loadImage(file);
  const scale = Math.min(
    1,
    MAX_CAPTURE_EDGE / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("이 브라우저에서는 사진을 처리할 수 없습니다.");
  }

  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return canvasToJpeg(canvas);
}
