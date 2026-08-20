import { ValidationError } from "@/contracts/errors";
import type { TextureStyleImage } from "./types";

const MAX_STYLE_IMAGE_BYTES = 2 * 1024 * 1024;
const DATA_URL_PATTERN = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/;

export function parseTextureStyleImage(dataUrl: string): TextureStyleImage {
  const match = dataUrl.match(DATA_URL_PATTERN);
  if (!match) {
    throw new ValidationError(
      "styleImageDataUrl must be a base64 JPEG or PNG data URL",
    );
  }

  const mimeType = match[1] as TextureStyleImage["mimeType"];
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > MAX_STYLE_IMAGE_BYTES) {
    throw new ValidationError("Style image must be between 1 byte and 2MB");
  }
  if (!hasExpectedMagicBytes(bytes, mimeType)) {
    throw new ValidationError("Style image content does not match its MIME type");
  }

  return { bytes, dataUrl, mimeType };
}

function hasExpectedMagicBytes(
  bytes: Buffer,
  mimeType: TextureStyleImage["mimeType"],
) {
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return (
    bytes.length >= pngSignature.length &&
    pngSignature.every((value, index) => bytes[index] === value)
  );
}
