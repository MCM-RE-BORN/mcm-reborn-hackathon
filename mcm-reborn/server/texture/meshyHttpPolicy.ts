export type MeshyHttpFailurePolicy = {
  kind: "AUTH" | "CREDITS" | "RATE_LIMIT" | "UPSTREAM" | "VALIDATION";
  message: string;
  retryable: boolean;
};

const MAX_RETRY_AFTER_MS = 60_000;

export function classifyMeshyHttpFailure(
  status: number,
  payload: unknown = null,
): MeshyHttpFailurePolicy {
  if (status === 402) {
    return {
      kind: "CREDITS",
      message: "Meshy API credits are insufficient",
      retryable: false,
    };
  }
  if (status === 429) {
    return {
      kind: "RATE_LIMIT",
      message: safeMeshyRateLimitMessage(payload),
      retryable: true,
    };
  }
  if (status === 401 || status === 403) {
    return {
      kind: "AUTH",
      message: "Meshy API credentials are invalid",
      retryable: false,
    };
  }
  if (status >= 400 && status < 500 && status !== 408) {
    return {
      kind: "VALIDATION",
      message:
        status === 400
          ? "Meshy API rejected the task request"
          : "Meshy API rejected the request",
      retryable: false,
    };
  }
  return {
    kind: "UPSTREAM",
    message: "Meshy API returned an error",
    retryable: false,
  };
}

export function readMeshyRetryAfterMs(
  headers: Headers,
  nowMs: number = Date.now(),
): number | null {
  const retryAfterMs = Number.parseFloat(headers.get("retry-after-ms") ?? "");
  if (Number.isFinite(retryAfterMs) && retryAfterMs >= 0) {
    return Math.min(MAX_RETRY_AFTER_MS, Math.round(retryAfterMs));
  }

  const rawRetryAfter = headers.get("retry-after");
  if (!rawRetryAfter) return null;
  const seconds = Number.parseFloat(rawRetryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(MAX_RETRY_AFTER_MS, Math.round(seconds * 1_000));
  }

  const timestamp = Date.parse(rawRetryAfter);
  if (!Number.isFinite(timestamp)) return null;
  return Math.min(MAX_RETRY_AFTER_MS, Math.max(0, timestamp - nowMs));
}

function safeMeshyRateLimitMessage(payload: unknown): string {
  const message =
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string"
      ? payload.message
      : "";
  if (message.includes("NoMoreConcurrentTasks")) {
    return "Meshy API concurrent task limit reached";
  }
  if (message.includes("RateLimitExceeded")) {
    return "Meshy API request rate limit exceeded";
  }
  return "Meshy API rate limit exceeded";
}
