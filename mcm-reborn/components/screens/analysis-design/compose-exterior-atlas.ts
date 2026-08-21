const MATERIAL_ASSET_ROOT =
  "/assets/models/reborn-passport-wallet";
const MATERIAL_MANIFEST_URL = `${MATERIAL_ASSET_ROOT}/material-assets.json`;
const ORIGINAL_BASE_COLOR_URL = `${MATERIAL_ASSET_ROOT}/original-base-color.jpg`;
const EXTERIOR_MASK_URL = `${MATERIAL_ASSET_ROOT}/exterior-mask.png`;
const STITCH_PRESERVE_MASK_URL = `${MATERIAL_ASSET_ROOT}/stitch-preserve-mask.png`;
const OUTPUT_SIZE = 2048;
const MANIFEST_SCHEMA = "MCM_PASSPORT_WALLET_MATERIAL_MAP_V2";

type MaterialAssetManifest = {
  atlasSize: [number, number];
  exteriorMask: {
    path: "exterior-mask.png";
    sha256: string;
  };
  originalMaps: {
    "original-base-color.jpg": string;
  };
  schemaVersion: typeof MANIFEST_SCHEMA;
  stitchPreserveMask: {
    path: "stitch-preserve-mask.png";
    sha256: string;
  };
};

type DecodedImage = {
  close: () => void;
  height: number;
  source: CanvasImageSource;
  width: number;
};

/**
 * Clamp an AI-produced target UV atlas to the reviewed passport-wallet map.
 *
 * White exterior-mask pixels receive the generated exterior only when the
 * stitch-preserve mask is black. Zipper, hardware, logos, stitching and unused
 * UV pixels stay visual equivalents of the original base-color atlas. The AI
 * output is never allowed to decide which target component it may overwrite.
 */
export async function composeExteriorAtlas(
  generatedAtlas: Blob,
): Promise<Blob> {
  if (!generatedAtlas.type.startsWith("image/") || generatedAtlas.size === 0) {
    throw new Error("생성된 외관 텍스처 형식이 올바르지 않습니다.");
  }

  const decodedImages: DecodedImage[] = [];

  try {
    const generated = rememberDecodedImage(
      decodedImages,
      await decodeImage(generatedAtlas),
    );
    if (
      generated.width < 256 ||
      generated.height < 256 ||
      Math.abs(generated.width / generated.height - 1) > 0.05
    ) {
      throw new Error("AI 외관 텍스처는 정사각형 UV 이미지여야 합니다.");
    }

    const manifest = await loadMaterialAssetManifest();
    const [originalBlob, exteriorMaskBlob, stitchPreserveMaskBlob] =
      await Promise.all([
        loadVerifiedAsset(
          ORIGINAL_BASE_COLOR_URL,
          manifest.originalMaps["original-base-color.jpg"],
        ),
        loadVerifiedAsset(
          EXTERIOR_MASK_URL,
          manifest.exteriorMask.sha256,
        ),
        loadVerifiedAsset(
          STITCH_PRESERVE_MASK_URL,
          manifest.stitchPreserveMask.sha256,
        ),
      ]);
    const original = rememberDecodedImage(
      decodedImages,
      await decodeImage(originalBlob),
    );
    const mask = rememberDecodedImage(
      decodedImages,
      await decodeImage(exteriorMaskBlob),
    );
    const stitchPreserveMask = rememberDecodedImage(
      decodedImages,
      await decodeImage(stitchPreserveMaskBlob),
    );

    if (
      original.width !== OUTPUT_SIZE ||
      original.height !== OUTPUT_SIZE ||
      mask.width !== OUTPUT_SIZE ||
      mask.height !== OUTPUT_SIZE ||
      stitchPreserveMask.width !== OUTPUT_SIZE ||
      stitchPreserveMask.height !== OUTPUT_SIZE
    ) {
      throw new Error("여권 지갑 소재 맵 자산의 크기가 올바르지 않습니다.");
    }

    const generatedPixels = drawToPixels(generated.source);
    const originalPixels = drawToPixels(original.source);
    const maskPixels = drawToPixels(mask.source);
    const stitchPreservePixels = drawToPixels(stitchPreserveMask.source);
    const output = new ImageData(OUTPUT_SIZE, OUTPUT_SIZE);

    for (let offset = 0; offset < output.data.length; offset += 4) {
      const exteriorMix = maskPixels.data[offset] / 255;
      const stitchKeep = stitchPreservePixels.data[offset] / 255;
      const mix = exteriorMix * (1 - stitchKeep);
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
    return canvasToPng(canvas);
  } finally {
    for (const image of decodedImages.reverse()) {
      image.close();
    }
  }
}

function rememberDecodedImage(
  images: DecodedImage[],
  image: DecodedImage,
) {
  images.push(image);
  return image;
}

async function loadVerifiedAsset(url: string, expectedSha256: string) {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error("여권 지갑 소재 맵 자산을 불러오지 못했습니다.");
  }
  const blob = await response.blob();
  if (blob.size === 0 || (await sha256(blob)) !== expectedSha256) {
    throw new Error("여권 지갑 소재 맵 자산의 무결성 검증에 실패했습니다.");
  }
  return blob;
}

async function loadMaterialAssetManifest(): Promise<MaterialAssetManifest> {
  const response = await fetch(MATERIAL_MANIFEST_URL, {
    cache: "force-cache",
  });
  if (!response.ok) {
    throw new Error("여권 지갑 소재 맵 정보를 불러오지 못했습니다.");
  }

  const manifest: unknown = await response.json();
  if (!isMaterialAssetManifest(manifest)) {
    throw new Error("여권 지갑 소재 맵 정보가 올바르지 않습니다.");
  }
  return manifest;
}

function isMaterialAssetManifest(
  value: unknown,
): value is MaterialAssetManifest {
  if (!isRecord(value)) {
    return false;
  }
  const atlasSize = value.atlasSize;
  const exteriorMask = value.exteriorMask;
  const stitchPreserveMask = value.stitchPreserveMask;
  const originalMaps = value.originalMaps;
  return (
    value.schemaVersion === MANIFEST_SCHEMA &&
    Array.isArray(atlasSize) &&
    atlasSize.length === 2 &&
    atlasSize[0] === OUTPUT_SIZE &&
    atlasSize[1] === OUTPUT_SIZE &&
    isAssetEntry(exteriorMask, "exterior-mask.png") &&
    isAssetEntry(stitchPreserveMask, "stitch-preserve-mask.png") &&
    isRecord(originalMaps) &&
    isSha256(originalMaps["original-base-color.jpg"])
  );
}

function isAssetEntry(value: unknown, expectedPath: string) {
  return (
    isRecord(value) &&
    value.path === expectedPath &&
    isSha256(value.sha256)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

async function sha256(blob: Blob) {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
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

function canvasToPng(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("UV 텍스처 인코딩에 실패했습니다."));
      },
      "image/png",
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
