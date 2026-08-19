import { NextResponse } from "next/server";
import { z } from "zod";

import { ValidationError } from "@/contracts/errors";
import { handleApiError } from "@/server/auth/errorHandler";
import { authenticate, requireRole } from "@/server/auth/middleware";
import { readJsonBody, zodErrorDetails } from "@/server/http/json";
import { createV2PresignedUploadUrls } from "@/server/storage/uploadService";

export const runtime = "nodejs";

const UploadFileRequestSchema = z
  .object({
    fileName: z.string().min(1).max(255),
    contentType: z.enum(["image/jpeg", "image/png"]),
    sizeBytes: z.number().int().min(1).max(10_485_760),
    purpose: z.enum([
      "SOURCE_FRONT",
      "SOURCE_SIDE",
      "INTERIOR",
      "ENGRAVING",
    ]),
  })
  .strict();

const PresignUploadRequestSchema = z
  .object({
    files: z.array(UploadFileRequestSchema).min(1).max(4),
  })
  .strict();

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await authenticate(request);
    requireRole(user, ["CUSTOMER"]);

    const { files } = PresignUploadRequestSchema.parse(
      await readJsonBody(request),
    );
    const assets = await createV2PresignedUploadUrls(
      user.id,
      user.accessToken,
      files,
    );

    return NextResponse.json(
      { assets },
      {
        headers: { "Cache-Control": "no-store" },
        status: 201,
      },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(
        new ValidationError("Invalid request body", zodErrorDetails(error)),
      );
    }
    return handleApiError(error);
  }
}
