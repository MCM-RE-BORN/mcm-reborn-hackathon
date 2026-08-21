import { z } from "zod";
import { ValidationError } from "@/contracts/errors";
import { handleApiError } from "@/server/auth/errorHandler";
import { authenticate, requireRole } from "@/server/auth/middleware";
import { readJsonBody, zodErrorDetails } from "@/server/http/json";
import { getMeshyTargetTextureAsset } from "@/server/texture/texturePreviewService";

export const runtime = "nodejs";
export const maxDuration = 60;

const TextureAssetRequestSchema = z
  .object({
    analysisId: z.string().uuid(),
    taskToken: z.string().min(16).max(1024),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await authenticate(request);
    requireRole(user, ["CUSTOMER"]);
    const input = TextureAssetRequestSchema.parse(await readJsonBody(request));
    const asset = await getMeshyTargetTextureAsset(
      input.analysisId,
      input.taskToken,
      user,
    );

    return withAssetSecurityHeaders(Response.json(asset, { status: 200 }));
  } catch (error) {
    const normalized =
      error instanceof z.ZodError
        ? new ValidationError(
            "Invalid texture asset request",
            zodErrorDetails(error),
          )
        : error;
    return withAssetSecurityHeaders(handleApiError(normalized));
  }
}

function withAssetSecurityHeaders(response: Response) {
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Vary", "Authorization");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
