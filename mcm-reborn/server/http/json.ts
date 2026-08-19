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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * 멱등성 요청 해시용 직렬화. 객체 키를 정렬해 같은 내용이면 항상 같은
 * 문자열이 나오게 한다. JSON.stringify는 키 순서를 보존하므로 그대로 쓰면
 * 논리적으로 동일한 요청이 다른 해시를 갖게 된다.
 */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
