const EXTRACTED_TEXTURE_SIZE = 512;
const MOCKUP_TEXTURE_SIZE = 1024;
const TILE_GRID_SIZE = 4;
const SOURCE_CROP_RATIO = 0.62;
const JPEG_QUALITY = 0.88;

export type PreparedSourceTexture = {
  extracted: Blob;
  prepared: Blob;
  sourceCropPercent: number;
};

type DecodedImage = {
  close: () => void;
  height: number;
  source: CanvasImageSource;
  width: number;
};

/**
 * Build an ephemeral texture preview entirely in the browser.
 *
 * The centered swatch avoids most background pixels, while mirrored tiles make
 * opposing edges meet without a hard seam. This is deliberately deterministic
 * so the core demo still works when an external image provider is unavailable.
 */
export async function prepareSourceTexture(
  sourceBlob: Blob,
): Promise<PreparedSourceTexture> {
  if (!sourceBlob.type.startsWith("image/")) {
    throw new Error("텍스처 원본은 이미지 파일이어야 합니다.");
  }

  const image = await decodeImage(sourceBlob);
  try {
    const shortestEdge = Math.min(image.width, image.height);
    if (shortestEdge < 64) {
      throw new Error("텍스처를 추출하기에 원본 사진이 너무 작습니다.");
    }

    const cropSize = Math.max(1, Math.round(shortestEdge * SOURCE_CROP_RATIO));
    const cropX = Math.round((image.width - cropSize) / 2);
    const cropY = Math.round((image.height - cropSize) / 2);
    const extractedCanvas = createCanvas(EXTRACTED_TEXTURE_SIZE);
    const extractedContext = requireContext(extractedCanvas);
    extractedContext.drawImage(
      image.source,
      cropX,
      cropY,
      cropSize,
      cropSize,
      0,
      0,
      EXTRACTED_TEXTURE_SIZE,
      EXTRACTED_TEXTURE_SIZE,
    );

    const preparedCanvas = createCanvas(MOCKUP_TEXTURE_SIZE);
    const preparedContext = requireContext(preparedCanvas);
    const tileSize = MOCKUP_TEXTURE_SIZE / TILE_GRID_SIZE;

    for (let row = 0; row < TILE_GRID_SIZE; row += 1) {
      for (let column = 0; column < TILE_GRID_SIZE; column += 1) {
        drawMirroredTile(
          preparedContext,
          extractedCanvas,
          column,
          row,
          tileSize,
        );
      }
    }

    const [extracted, prepared] = await Promise.all([
      canvasToJpeg(extractedCanvas),
      canvasToJpeg(preparedCanvas),
    ]);

    return {
      extracted,
      prepared,
      sourceCropPercent: Math.round(SOURCE_CROP_RATIO * 100),
    };
  } finally {
    image.close();
  }
}

function createCanvas(size: number) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function requireContext(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    throw new Error("이 브라우저에서는 텍스처를 만들 수 없습니다.");
  }
  return context;
}

function drawMirroredTile(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  column: number,
  row: number,
  tileSize: number,
) {
  const flipX = column % 2 === 1;
  const flipY = row % 2 === 1;
  context.save();
  context.translate(
    (column + (flipX ? 1 : 0)) * tileSize,
    (row + (flipY ? 1 : 0)) * tileSize,
  );
  context.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  context.drawImage(source, 0, 0, tileSize, tileSize);
  context.restore();
}

function canvasToJpeg(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("텍스처 이미지 인코딩에 실패했습니다."));
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
      element.onerror = () => reject(new Error("원본 사진을 읽지 못했습니다."));
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
