import OpenAI, { toFile } from "openai";
import { ServiceUnavailableError, UpstreamError } from "@/contracts/errors";
import type { TextureImageProvider, TextureStyleImage } from "./types";

const TEXTURE_PROMPT = `Create a production-ready seamless square base-color texture from the supplied cropped material sample.

Requirements:
- Preserve the source material's color, grain, printed motif, spacing, scale, and visible age character as faithfully as possible.
- Remove directional lighting, glare, cast shadows, perspective distortion, background, hardware, seams, and product silhouette.
- Make all four edges tile seamlessly without a visible border.
- Keep the image flat and evenly lit like an orthographic material scan.
- Do not invent new logos, lettering, symbols, stitching, damage, or decorative elements.
- Fill the entire image with only the recovered material surface.

Return one square texture image only.`;

const MAX_TEXTURE_OUTPUT_BYTES = 5 * 1024 * 1024;

/** OpenAI image-edit adapter for an ephemeral base-color texture preview. */
export class OpenAiTextureProvider implements TextureImageProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const model = process.env.OPENAI_IMAGE_MODEL?.trim();
    if (!apiKey || !model) {
      throw new ServiceUnavailableError(
        "OpenAI texture generation is not configured",
        { retryable: false },
      );
    }

    this.client = new OpenAI({ apiKey, maxRetries: 0, timeout: 120_000 });
    this.model = model;
  }

  async createTexture(styleImage: TextureStyleImage) {
    try {
      const extension = styleImage.mimeType === "image/png" ? "png" : "jpg";
      const image = await toFile(styleImage.bytes, `source-texture.${extension}`, {
        type: styleImage.mimeType,
      });
      const response = await this.client.images.edit({
        image,
        ...(usesConfigurableInputFidelity(this.model)
          ? { input_fidelity: "high" as const }
          : {}),
        model: this.model,
        n: 1,
        output_compression: 84,
        output_format: "jpeg",
        prompt: TEXTURE_PROMPT,
        quality: "medium",
        size: "1024x1024",
      });
      const base64 = response.data?.[0]?.b64_json;
      if (!base64) {
        throw new Error("OPENAI_TEXTURE_OUTPUT_EMPTY");
      }
      const output = Buffer.from(base64, "base64");
      if (
        output.length === 0 ||
        output.length > MAX_TEXTURE_OUTPUT_BYTES ||
        output[0] !== 0xff ||
        output[1] !== 0xd8 ||
        output[2] !== 0xff
      ) {
        throw new Error("OPENAI_TEXTURE_OUTPUT_INVALID");
      }

      return {
        dataUrl: `data:image/jpeg;base64,${base64}`,
        kind: "texture" as const,
        mimeType: "image/jpeg" as const,
        provider: "OPENAI" as const,
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableError) throw error;
      throw new UpstreamError("OpenAI texture generation failed");
    }
  }
}

export function isOpenAiTextureConfigured() {
  return Boolean(
    process.env.OPENAI_API_KEY?.trim() &&
      process.env.OPENAI_IMAGE_MODEL?.trim(),
  );
}

function usesConfigurableInputFidelity(model: string) {
  return model !== "gpt-image-2" && !model.startsWith("gpt-image-2-");
}
