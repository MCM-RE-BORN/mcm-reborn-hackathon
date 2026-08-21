import OpenAI, { type APIError } from 'openai';

export type OpenAiRequestStage = 'FINAL_ANALYSIS';

export type OpenAiFailureKind =
  | 'QUOTA_EXHAUSTED'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'PROVIDER_ERROR'
  | 'QUEUE_TIMEOUT';

export interface VisionProviderFailureMetadata {
  stage: OpenAiRequestStage | 'QUEUE';
  kind: OpenAiFailureKind;
  status: number | null;
  code: string | null;
  type: string | null;
  requestId: string | null;
  retryAfterMs: number | null;
  attempts: number;
  elapsedMs: number;
  rateLimit: {
    limitRequests: string | null;
    remainingRequests: string | null;
    resetRequests: string | null;
    limitTokens: string | null;
    remainingTokens: string | null;
    resetTokens: string | null;
  };
}

export class OpenAiProviderExecutionError extends Error {
  public readonly metadata: VisionProviderFailureMetadata;

  constructor(
    metadata: VisionProviderFailureMetadata,
    cause: unknown,
  ) {
    super(`OPENAI_${metadata.stage}_${metadata.kind}`, { cause });
    this.name = 'OpenAiProviderExecutionError';
    this.metadata = metadata;
  }
}

type PolicyState = {
  cooldownUntilMs: number;
  tail: Promise<void>;
};

type PolicyGlobal = typeof globalThis & {
  __mcmOpenAiPolicyState?: PolicyState;
};

type RunOpenAiStageOptions<T> = {
  call: (requestOptions: {
    attempt: number;
    timeoutMs: number;
  }) => Promise<T>;
  deadlineAtMs: number;
  now?: () => number;
  random?: () => number;
  sleep?: (delayMs: number) => Promise<void>;
  stage: OpenAiRequestStage;
};

const DEFAULT_RETRY_DELAY_MS = 750;
const MAX_SERVER_RETRY_DELAY_MS = 60_000;
const MIN_ATTEMPT_WINDOW_MS = 5_000;
const REQUEST_TIMEOUT_MS = 60_000;

function policyState(): PolicyState {
  const policyGlobal = globalThis as PolicyGlobal;
  policyGlobal.__mcmOpenAiPolicyState ??= {
    cooldownUntilMs: 0,
    tail: Promise.resolve(),
  };
  return policyGlobal.__mcmOpenAiPolicyState;
}

/**
 * Serialize the full LIVE analysis in one server process. This prevents the
 * knowledge and final stages of different requests from creating a local
 * request burst. Serverless instances still require an external distributed
 * limiter when traffic grows beyond the MVP deployment.
 */
export async function runSerializedOpenAiAnalysis<T>(
  deadlineAtMs: number,
  operation: () => Promise<T>,
  now: () => number = Date.now,
): Promise<T> {
  const state = policyState();
  const previous = state.tail.catch(() => undefined);
  let release: () => void = () => undefined;
  const ticket = new Promise<void>((resolve) => {
    release = resolve;
  });
  state.tail = previous.then(() => ticket);

  try {
    await waitForQueue(previous, deadlineAtMs, now);
    return await operation();
  } finally {
    release();
  }
}

/** Retry one transient 429 while respecting the provider's Retry-After. */
export async function runOpenAiStage<T>(
  options: RunOpenAiStageOptions<T>,
): Promise<T> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;
  const startedAtMs = now();
  let attempts = 0;

  while (attempts < 2) {
    attempts += 1;
    await respectSharedCooldown(options.deadlineAtMs, now, sleep);
    const remainingMs = options.deadlineAtMs - now();
    if (remainingMs < MIN_ATTEMPT_WINDOW_MS) {
      throw new OpenAiProviderExecutionError(
        emptyFailureMetadata(
          'QUEUE',
          'QUEUE_TIMEOUT',
          attempts - 1,
          now() - startedAtMs,
        ),
        new Error('OPENAI_ANALYSIS_DEADLINE_EXCEEDED'),
      );
    }

    try {
      return await options.call({
        attempt: attempts,
        timeoutMs: Math.min(REQUEST_TIMEOUT_MS, remainingMs),
      });
    } catch (error) {
      const metadata = failureMetadata(
        error,
        options.stage,
        attempts,
        now() - startedAtMs,
      );
      const shouldRetry =
        metadata.kind === 'RATE_LIMIT' && attempts === 1;
      if (!shouldRetry) {
        throw new OpenAiProviderExecutionError(metadata, error);
      }

      const retryDelayMs = retryDelay(metadata, random);
      const retryWouldExceedDeadline =
        retryDelayMs > MAX_SERVER_RETRY_DELAY_MS ||
        now() + retryDelayMs + MIN_ATTEMPT_WINDOW_MS > options.deadlineAtMs;
      if (retryWouldExceedDeadline) {
        throw new OpenAiProviderExecutionError(metadata, error);
      }

      const state = policyState();
      state.cooldownUntilMs = Math.max(
        state.cooldownUntilMs,
        now() + retryDelayMs,
      );
    }
  }

  throw new Error('OPENAI_RETRY_POLICY_UNREACHABLE');
}

export function readProviderFailureMetadata(
  error: unknown,
): VisionProviderFailureMetadata | null {
  let current = error;
  const visited = new Set<unknown>();
  while (current && !visited.has(current)) {
    visited.add(current);
    if (current instanceof OpenAiProviderExecutionError) {
      return current.metadata;
    }
    current = readCause(current);
  }
  return null;
}

export function resetOpenAiRequestPolicyForTests(): void {
  const policyGlobal = globalThis as PolicyGlobal;
  delete policyGlobal.__mcmOpenAiPolicyState;
}

function failureMetadata(
  error: unknown,
  stage: OpenAiRequestStage,
  attempts: number,
  elapsedMs: number,
): VisionProviderFailureMetadata {
  const apiError = findApiError(error);
  if (!apiError) {
    const timeout = error instanceof OpenAI.APIConnectionTimeoutError;
    return emptyFailureMetadata(
      stage,
      timeout ? 'TIMEOUT' : 'PROVIDER_ERROR',
      attempts,
      elapsedMs,
    );
  }

  const code = safeHeaderValue(apiError.code);
  const type = safeHeaderValue(apiError.type);
  if (apiError instanceof OpenAI.APIConnectionTimeoutError) {
    return {
      ...emptyFailureMetadata(stage, 'TIMEOUT', attempts, elapsedMs),
      code,
      requestId: safeHeaderValue(apiError.requestID),
      type,
    };
  }
  const quotaExhausted =
    code === 'insufficient_quota' ||
    code === 'billing_hard_limit_reached' ||
    code === 'usage_limit_reached';
  const kind: OpenAiFailureKind = quotaExhausted
    ? 'QUOTA_EXHAUSTED'
    : apiError.status === 429
      ? 'RATE_LIMIT'
      : 'PROVIDER_ERROR';
  const headers = apiError.headers;

  return {
    stage,
    kind,
    status: apiError.status ?? null,
    code,
    type,
    requestId:
      safeHeaderValue(apiError.requestID) ??
      safeHeaderValue(headers?.get('x-request-id')),
    retryAfterMs: parseRetryAfterMs(headers),
    attempts,
    elapsedMs: Math.max(0, Math.round(elapsedMs)),
    rateLimit: {
      limitRequests: safeHeaderValue(headers?.get('x-ratelimit-limit-requests')),
      remainingRequests: safeHeaderValue(
        headers?.get('x-ratelimit-remaining-requests'),
      ),
      resetRequests: safeHeaderValue(headers?.get('x-ratelimit-reset-requests')),
      limitTokens: safeHeaderValue(headers?.get('x-ratelimit-limit-tokens')),
      remainingTokens: safeHeaderValue(
        headers?.get('x-ratelimit-remaining-tokens'),
      ),
      resetTokens: safeHeaderValue(headers?.get('x-ratelimit-reset-tokens')),
    },
  };
}

function emptyFailureMetadata(
  stage: VisionProviderFailureMetadata['stage'],
  kind: OpenAiFailureKind,
  attempts: number,
  elapsedMs: number,
): VisionProviderFailureMetadata {
  return {
    stage,
    kind,
    status: null,
    code: null,
    type: null,
    requestId: null,
    retryAfterMs: null,
    attempts,
    elapsedMs: Math.max(0, Math.round(elapsedMs)),
    rateLimit: {
      limitRequests: null,
      remainingRequests: null,
      resetRequests: null,
      limitTokens: null,
      remainingTokens: null,
      resetTokens: null,
    },
  };
}

function findApiError(error: unknown): APIError | null {
  let current = error;
  const visited = new Set<unknown>();
  while (current && !visited.has(current)) {
    visited.add(current);
    if (current instanceof OpenAI.APIError) return current;
    current = readCause(current);
  }
  return null;
}

function readCause(error: unknown): unknown {
  return error instanceof Error && 'cause' in error ? error.cause : null;
}

function parseRetryAfterMs(headers: Headers | undefined): number | null {
  if (!headers) return null;
  const retryAfterMs = Number.parseFloat(headers.get('retry-after-ms') ?? '');
  if (Number.isFinite(retryAfterMs) && retryAfterMs >= 0) {
    return Math.round(retryAfterMs);
  }

  const rawRetryAfter = headers.get('retry-after');
  if (!rawRetryAfter) return null;
  const seconds = Number.parseFloat(rawRetryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1_000);
  }
  const timestamp = Date.parse(rawRetryAfter);
  return Number.isFinite(timestamp)
    ? Math.max(0, timestamp - Date.now())
    : null;
}

function retryDelay(
  metadata: VisionProviderFailureMetadata,
  random: () => number,
): number {
  if (metadata.retryAfterMs !== null) return metadata.retryAfterMs;
  const boundedRandom = Math.min(1, Math.max(0, random()));
  return Math.round(DEFAULT_RETRY_DELAY_MS * (0.75 + boundedRandom * 0.25));
}

async function respectSharedCooldown(
  deadlineAtMs: number,
  now: () => number,
  sleep: (delayMs: number) => Promise<void>,
): Promise<void> {
  const delayMs = Math.max(0, policyState().cooldownUntilMs - now());
  if (delayMs === 0) return;
  if (now() + delayMs + MIN_ATTEMPT_WINDOW_MS > deadlineAtMs) {
    throw new OpenAiProviderExecutionError(
      emptyFailureMetadata('QUEUE', 'QUEUE_TIMEOUT', 0, 0),
      new Error('OPENAI_RATE_LIMIT_COOLDOWN_EXCEEDS_DEADLINE'),
    );
  }
  await sleep(delayMs);
}

async function waitForQueue(
  previous: Promise<void>,
  deadlineAtMs: number,
  now: () => number,
): Promise<void> {
  const remainingMs = deadlineAtMs - now();
  if (remainingMs <= 0) {
    throw new OpenAiProviderExecutionError(
      emptyFailureMetadata('QUEUE', 'QUEUE_TIMEOUT', 0, 0),
      new Error('OPENAI_ANALYSIS_QUEUE_TIMEOUT'),
    );
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      previous,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new OpenAiProviderExecutionError(
              emptyFailureMetadata('QUEUE', 'QUEUE_TIMEOUT', 0, remainingMs),
              new Error('OPENAI_ANALYSIS_QUEUE_TIMEOUT'),
            ),
          );
        }, remainingMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function safeHeaderValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, 120);
}

function defaultSleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
