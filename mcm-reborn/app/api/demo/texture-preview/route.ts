import { NextResponse } from "next/server";
import { z } from "zod";
import { ValidationError } from "@/contracts/errors";
import {
  TEXTURE_PRIVACY_NOTICE_VERSION,
} from "@/lib/texture-preview";
import { handleApiError } from "@/server/auth/errorHandler";
import { authenticate, requireRole } from "@/server/auth/middleware";
import { readJsonBody, zodErrorDetails } from "@/server/http/json";
import {
  createTexturePreview,
  getMeshyTextureTask,
  getTextureProviderCapabilities,
} from "@/server/texture/texturePreviewService";

export const runtime = "nodejs";
export const maxDuration = 180;

const CreateTexturePreviewRequestSchema = z
  .object({
    analysisId: z.string().uuid(),
    externalAiProcessingConsentAccepted: z.literal(true),
    jobKind: z.enum([
      "EXTERIOR_PLAN",
      "SOURCE_MODEL",
      "TARGET_RETEXTURE",
    ]),
    privacyNoticeVersion: z.literal(TEXTURE_PRIVACY_NOTICE_VERSION),
  })
  .strict();

const TaskRequestSchema = z
  .object({
  analysisId: z.string().uuid(),
  taskToken: z.string().min(16).max(1024),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await authenticate(request);
    requireRole(user, ["CUSTOMER"]);
    const input = CreateTexturePreviewRequestSchema.parse(
      await readJsonBody(request),
    );
    const response = await createTexturePreview(
      {
        ...input,
        idempotencyKey: readIdempotencyKey(request),
      },
      user,
    );
    const status = response.kind === "task" ? 202 : 200;
    return json(response, status);
  } catch (error) {
    return routeError(error);
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await authenticate(request);
    requireRole(user, ["CUSTOMER"]);
    return json(getTextureProviderCapabilities(), 200);
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const user = await authenticate(request);
    requireRole(user, ["CUSTOMER"]);
    const input = TaskRequestSchema.parse(await readJsonBody(request));
    return json(
      await getMeshyTextureTask(input.analysisId, input.taskToken, user),
      200,
    );
  } catch (error) {
    return routeError(error);
  }
}

function readIdempotencyKey(request: Request) {
  const key = request.headers.get("idempotency-key")?.trim();
  if (!key || key.length < 8 || key.length > 128) {
    throw new ValidationError(
      "Idempotency-Key must be between 8 and 128 characters",
      { field: "Idempotency-Key" },
    );
  }
  return key;
}

function json<T>(body: T, status: number) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
    status,
  });
}

function routeError(error: unknown) {
  if (error instanceof z.ZodError) {
    return handleApiError(
      new ValidationError("Invalid texture preview request", zodErrorDetails(error)),
    );
  }
  return handleApiError(error);
}
