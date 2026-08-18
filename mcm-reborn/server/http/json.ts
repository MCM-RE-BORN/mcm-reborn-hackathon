import "server-only";

import type { ZodError } from "zod";

import { ValidationError } from "@/contracts/errors";

const DEFAULT_JSON_BODY_LIMIT = 32_768;

export async function readJsonBody(
  request: Request,
  limit = DEFAULT_JSON_BODY_LIMIT,
): Promise<unknown> {
  const mediaType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (mediaType !== "application/json") {
    throw new ValidationError("Content-Type must be application/json", {
      field: "Content-Type",
    });
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > limit) {
    throw new ValidationError("Request body is too large");
  }

  const text = await request.text();
  if (text.length === 0) {
    throw new ValidationError("Request body is required");
  }
  if (text.length > limit) {
    throw new ValidationError("Request body is too large");
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
}

export function zodErrorDetails(
  error: ZodError,
): Record<string, unknown> {
  return {
    issues: error.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
      path: issue.path,
    })),
  };
}
