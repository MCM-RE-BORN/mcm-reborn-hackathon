const MATERIAL_ASSET_ROOT =
  "/assets/models/reborn-passport-wallet";
const ORIGINAL_BASE_COLOR_URL = `${MATERIAL_ASSET_ROOT}/original-base-color.jpg`;
const EXTERIOR_MASK_URL = `${MATERIAL_ASSET_ROOT}/exterior-mask.png`;
const OUTPUT_SIZE = 2048;
const JPEG_QUALITY = 0.9;

type DecodedImage = {
  close: () => void;
  height: number;
  source: CanvasImageSource;
  width: number;
};

/**
 * Clamp an AI-produced target UV atlas to the reviewed passport-wallet map.
 *
 * White mask pixels receive the generated exterior. Zipper, hardware, logos,
 * stitching and unused UV pixels stay byte-for-byte visual equivalents of the
 * original base-color atlas. The AI output is never allowed to decide which
 * target component it may overwrite.
 */
export async function composeExteriorAtlas(
  generatedAtlas: Blob,
): Promise<Blob> {
  if (!generatedAtlas.type.startsWith("image/") || generatedAtlas.size === 0) {
    throw new Error("생성된 외관 텍스처 형식이 올바르지 않습니다.");
  }

  const [generated, original, mask] = await Promise.all([
    decodeImage(generatedAtlas),
    loadPublicImage(ORIGINAL_BASE_COLOR_URL),
    loadPublicImage(EXTERIOR_MASK_URL),
  ]);

  try {
    if (
      generated.width < 256 ||
      generated.height < 256 ||
      Math.abs(generated.width / generated.height - 1) > 0.05
    ) {
      throw new Error("AI 외관 텍스처는 정사각형 UV 이미지여야 합니다.");
    }
    if (
      original.width !== OUTPUT_SIZE ||
      original.height !== OUTPUT_SIZE ||
      mask.width !== OUTPUT_SIZE ||
      mask.height !== OUTPUT_SIZE
    ) {
      throw new Error("여권 지갑 소재 맵 자산의 크기가 올바르지 않습니다.");
    }

    const generatedPixels = drawToPixels(generated.source);
    const originalPixels = drawToPixels(original.source);
    const maskPixels = drawToPixels(mask.source);
    const output = new ImageData(OUTPUT_SIZE, OUTPUT_SIZE);

    for (let offset = 0; offset < output.data.length; offset += 4) {
      const mix = maskPixels.data[offset] / 255;
      const keep = 1 - mix;
      output.data[offset] = Math.round(
        generatedPixels.data[offset] * mix + originalPixels.data[offset] * keep,
      );
      output.data[offset + 1] = Math.round(
        generatedPixels.data[offset + 1] * mix +
          originalPixels.data[offset + 1] * keep,
      );
      output.data[offset + 2] = Math.round(
        generatedPixels.data[offset + 2] * mix +
          originalPixels.data[offset + 2] * keep,
      );
      output.data[offset + 3] = 255;
    }

    const canvas = createCanvas();
    requireContext(canvas).putImageData(output, 0, 0);
    return canvasToJpeg(canvas);
  } finally {
    generated.close();
    original.close();
    mask.close();
  }
}

async function loadPublicImage(url: string) {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error("여권 지갑 소재 맵 자산을 불러오지 못했습니다.");
  }
  return decodeImage(await response.blob());
}

function drawToPixels(source: CanvasImageSource) {
  const canvas = createCanvas();
  const context = requireContext(canvas);
  context.drawImage(source, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  return context.getImageData(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
}

function createCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  return canvas;
}

function requireContext(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    throw new Error("이 브라우저에서는 UV 텍스처를 합성할 수 없습니다.");
  }
  return context;
}

function canvasToJpeg(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("UV 텍스처 인코딩에 실패했습니다."));
      },
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

async function decodeImage(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    return {
      close: () => bitmap.close(),
      height: bitmap.height,
      source: bitmap,
      width: bitmap.width,
    };
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new window.Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("UV 텍스처를 읽지 못했습니다."));
      element.src = objectUrl;
    });
    return {
      close: () => URL.revokeObjectURL(objectUrl),
      height: image.naturalHeight,
      source: image,
      width: image.naturalWidth,
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}
