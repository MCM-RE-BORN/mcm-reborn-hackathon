import { NextResponse } from "next/server";
import type { z } from "zod";

import { ValidationError } from "@/contracts/errors";
import type { ApiResult, ApplicationStatus } from "@/server/applications/v2-application-service";
import { isApplicationStatus } from "@/server/applications/v2-application-service";
import { readJsonBody, zodErrorDetails } from "@/server/http/json";

export async function parseJsonRequest<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  const parsed = schema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    throw new ValidationError(
      "Invalid request body",
      zodErrorDetails(parsed.error),
    );
  }
  return parsed.data;
}

export function jsonApiResult(result: ApiResult): NextResponse {
  return NextResponse.json(result.body, {
    headers: { "Cache-Control": "no-store" },
    status: result.status,
  });
}

export function readStatusFilter(request: Request): ApplicationStatus | null {
  const value = new URL(request.url).searchParams.get("status");
  if (value === null) {
    return null;
  }
  if (!isApplicationStatus(value)) {
    throw new ValidationError("status is not a valid application status", {
      field: "status",
    });
  }
  return value;
}

export function readOperatorQuery(request: Request): string | null {
  const value = new URL(request.url).searchParams.get("query");
  if (value === null) {
    return null;
  }
  if (value.length > 80) {
    throw new ValidationError("query must be at most 80 characters", {
      field: "query",
    });
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
