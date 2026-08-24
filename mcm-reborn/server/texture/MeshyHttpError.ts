import {
  AppError,
  RateLimitError,
  ServiceUnavailableError,
  UpstreamError,
  ValidationError,
} from "@/contracts/errors";
import { classifyMeshyHttpFailure } from "./meshyHttpPolicy";

/** A documented HTTP rejection received before a usable task ID exists. */
export class MeshyHttpRejectionError extends AppError {
  constructor(error: AppError) {
    super(error.code, error.statusCode, error.message, error.details);
    this.name = "MeshyHttpRejectionError";
  }
}

/** Convert only Meshy's documented HTTP statuses and allowlisted 429 kinds. */
export async function throwMeshyHttpError(response: Response): Promise<never> {
  const payload = response.status === 429 ? await readJson(response) : null;
  const failure = classifyMeshyHttpFailure(response.status, payload);
  if (failure.kind === "UPSTREAM") {
    throw new UpstreamError(failure.message, { retryable: false });
  }
  if (failure.kind === "RATE_LIMIT") {
    throw new MeshyHttpRejectionError(new RateLimitError(failure.message));
  }
  if (failure.kind === "VALIDATION") {
    throw new MeshyHttpRejectionError(new ValidationError(failure.message));
  }
  throw new MeshyHttpRejectionError(
    new ServiceUnavailableError(failure.message, {
      retryable: failure.retryable,
    }),
  );
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    // Never surface or log an unrecognized provider body.
    return null;
  }
}
