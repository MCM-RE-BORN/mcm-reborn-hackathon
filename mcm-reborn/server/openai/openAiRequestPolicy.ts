import { randomUUID } from 'crypto';
import OpenAI, { type APIError } from 'openai';

export type OpenAiRequestStage = 'WIKI_LOOKUP' | 'FINAL_ANALYSIS';

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
  clientRequestId: string | null;
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
    limitProjectTokens: string | null;
    remainingProjectTokens: string | null;
    resetProjectTokens: string | null;
  };
}

export class OpenAiProviderExecutionError extends Error {
  public readonly metadata: VisionProviderFailureMetadata;

  constructor(metadata: VisionProviderFailureMetadata, cause: unknown) {
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
    clientRequestId: string;
    timeoutMs: number;
  }) => Promise<T>;
  createClientRequestId?: () => string;
  deadlineAtMs: number;
  maxAttempts: 1 | 2;
  now?: () => number;
  onRetry?: (metadata: VisionProviderFailureMetadata) => void;
  random?: () => number;
  sleep?: (delayMs: number) => Promise<void>;
  stage: OpenAiRequestStage;
};

const DEFAULT_RETRY_DELAY_MS = 1_000;
const MAX_SERVER_RETRY_DELAY_MS = 60_000;
const MIN_ATTEMPT_WINDOW_MS = 5_000;
const REQUEST_TIMEOUT_MS = 60_000;
const MIN_RETRY_JITTER_MS = 100;
const MAX_RETRY_JITTER_MS = 500;
const QUOTA_MARKERS = new Set([
  'billing_hard_limit_reached',
  'credit_balance_exhausted',
  'insufficient_quota',
  'organization_spend_limit_exceeded',
  'organization_usage_limit_exceeded',
  'project_spend_limit_exceeded',
  'project_usage_limit_exceeded',
  'usage_limit_reached',
]);

function policyState(): PolicyState {
  const policyGlobal = globalThis as PolicyGlobal;
  policyGlobal.__mcmOpenAiPolicyState ??= {
    cooldownUntilMs: 0,
    tail: Promise.resolve(),
  };
  return policyGlobal.__mcmOpenAiPolicyState;
}

/**
 * Serialize one full LIVE analysis inside a server process. Serverless
 * instances still need a distributed limiter when the MVP grows beyond a
 * single-instance traffic pattern.
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

/**
 * Run one provider stage within a shared deadline. Transient rate, timeout,
 * conflict, and upstream failures may be retried; quota and client failures
 * never are. SDK retries stay disabled so attempts are not multiplied.
 */
export async function runOpenAiStage<T>(
  options: RunOpenAiStageOptions<T>,
): Promise<T> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;
  const createClientRequestId = options.createClientRequestId ?? randomUUID;
  const startedAtMs = now();
  let attempts = 0;

  while (attempts < options.maxAttempts) {
    await respectSharedCooldown(options.deadlineAtMs, now, sleep);
    const remainingMs = options.deadlineAtMs - now();
    if (remainingMs < MIN_ATTEMPT_WINDOW_MS) {
      throw new OpenAiProviderExecutionError(
        emptyFailureMetadata(
          'QUEUE',
          'QUEUE_TIMEOUT',
          attempts,
          now() - startedAtMs,
        ),
        new Error('OPENAI_ANALYSIS_DEADLINE_EXCEEDED'),
      );
    }

    attempts += 1;
    const clientRequestId = createClientRequestId();
    try {
      return await options.call({
        attempt: attempts,
        clientRequestId,
        timeoutMs: Math.min(REQUEST_TIMEOUT_MS, remainingMs),
      });
    } catch (error) {
      const metadata = failureMetadata(
        error,
        options.stage,
        clientRequestId,
        attempts,
        now() - startedAtMs,
        now(),
      );
      if (!isRetryableProviderFailure(metadata)) {
        throw new OpenAiProviderExecutionError(metadata, error);
      }

      const delayMs = retryDelay(metadata, random);
      if (metadata.kind === 'RATE_LIMIT') {
        // Preserve the provider's minimum wait even when this request cannot
        // retry, so the next queued analysis does not collide with the bucket.
        const state = policyState();
        state.cooldownUntilMs = Math.max(
          state.cooldownUntilMs,
          now() + delayMs,
        );
      }

      const retryFitsDeadline =
        retryBaseDelay(metadata) <= MAX_SERVER_RETRY_DELAY_MS &&
        now() + delayMs + MIN_ATTEMPT_WINDOW_MS <= options.deadlineAtMs;
      if (attempts >= options.maxAttempts || !retryFitsDeadline) {
        throw new OpenAiProviderExecutionError(metadata, error);
      }

      options.onRetry?.(metadata);
      if (metadata.kind !== 'RATE_LIMIT') {
        await sleep(delayMs);
      }
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

/** Reserve time for a required stage and skip an optional stage when needed. */
export function calculateOptionalStageDeadline(
  overallDeadlineAtMs: number,
  nowMs: number,
  optionalStageMaxMs: number,
  requiredStageReserveMs: number,
): number | null {
  const deadlineAtMs = Math.min(
    nowMs + optionalStageMaxMs,
    overallDeadlineAtMs - requiredStageReserveMs,
  );
  return deadlineAtMs - nowMs >= MIN_ATTEMPT_WINDOW_MS
    ? deadlineAtMs
    : null;
}

function failureMetadata(
  error: unknown,
  stage: OpenAiRequestStage,
  clientRequestId: string,
  attempts: number,
  elapsedMs: number,
  nowMs: number,
): VisionProviderFailureMetadata {
  if (findConnectionTimeoutError(error)) {
    return {
      ...emptyFailureMetadata(stage, 'TIMEOUT', attempts, elapsedMs),
      clientRequestId,
    };
  }

  const apiError = findApiError(error);
  if (!apiError) {
    return {
      ...emptyFailureMetadata(stage, 'PROVIDER_ERROR', attempts, elapsedMs),
      clientRequestId,
    };
  }

  const code = safeValue(apiError.code);
  const type = safeValue(apiError.type);
  const kind: OpenAiFailureKind = isQuotaFailure(code, type)
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
      safeValue(apiError.requestID) ??
      safeValue(headers?.get('x-request-id')),
    clientRequestId,
    retryAfterMs: parseRetryAfterMs(headers, nowMs),
    attempts,
    elapsedMs: Math.max(0, Math.round(elapsedMs)),
    rateLimit: {
      limitRequests: safeValue(headers?.get('x-ratelimit-limit-requests')),
      remainingRequests: safeValue(
        headers?.get('x-ratelimit-remaining-requests'),
      ),
      resetRequests: safeValue(headers?.get('x-ratelimit-reset-requests')),
      limitTokens: safeValue(headers?.get('x-ratelimit-limit-tokens')),
      remainingTokens: safeValue(
        headers?.get('x-ratelimit-remaining-tokens'),
      ),
      resetTokens: safeValue(headers?.get('x-ratelimit-reset-tokens')),
      limitProjectTokens: safeValue(
        headers?.get('x-ratelimit-limit-project-tokens'),
      ),
      remainingProjectTokens: safeValue(
        headers?.get('x-ratelimit-remaining-project-tokens'),
      ),
      resetProjectTokens: safeValue(
        headers?.get('x-ratelimit-reset-project-tokens'),
      ),
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
    clientRequestId: null,
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
      limitProjectTokens: null,
      remainingProjectTokens: null,
      resetProjectTokens: null,
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

function findConnectionTimeoutError(error: unknown): Error | null {
  let current = error;
  const visited = new Set<unknown>();
  while (current && !visited.has(current)) {
    visited.add(current);
    if (current instanceof OpenAI.APIConnectionTimeoutError) return current;
    current = readCause(current);
  }
  return null;
}

function readCause(error: unknown): unknown {
  return error instanceof Error && 'cause' in error ? error.cause : null;
}

function isQuotaFailure(code: string | null, type: string | null): boolean {
  return [code, type].some((value) => {
    if (!value) return false;
    const normalized = value.toLowerCase();
    return (
      QUOTA_MARKERS.has(normalized) ||
      /^(organization|project)_(spend|usage)_limit_exceeded$/.test(
        normalized,
      )
    );
  });
}

function isRetryableProviderFailure(
  metadata: VisionProviderFailureMetadata,
): boolean {
  if (metadata.kind === 'RATE_LIMIT' || metadata.kind === 'TIMEOUT') {
    return true;
  }
  if (metadata.kind !== 'PROVIDER_ERROR' || metadata.status === null) {
    return false;
  }
  return (
    metadata.status === 408 ||
    metadata.status === 409 ||
    metadata.status >= 500
  );
}

function parseRetryAfterMs(
  headers: Headers | undefined,
  nowMs: number,
): number | null {
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
    ? Math.max(0, timestamp - nowMs)
    : null;
}

function retryDelay(
  metadata: VisionProviderFailureMetadata,
  random: () => number,
): number {
  const boundedRandom = Math.min(1, Math.max(0, random()));
  const jitterMs = Math.round(
    MIN_RETRY_JITTER_MS +
      boundedRandom * (MAX_RETRY_JITTER_MS - MIN_RETRY_JITTER_MS),
  );
  return retryBaseDelay(metadata) + jitterMs;
}

function retryBaseDelay(
  metadata: VisionProviderFailureMetadata,
): number {
  const resetDelayMs = exhaustedBucketResetDelay(metadata);
  if (metadata.retryAfterMs === null && resetDelayMs === null) {
    return DEFAULT_RETRY_DELAY_MS;
  }
  return Math.max(metadata.retryAfterMs ?? 0, resetDelayMs ?? 0);
}

function exhaustedBucketResetDelay(
  metadata: VisionProviderFailureMetadata,
): number | null {
  const buckets: Array<[string | null, string | null]> = [
    [
      metadata.rateLimit.remainingRequests,
      metadata.rateLimit.resetRequests,
    ],
    [metadata.rateLimit.remainingTokens, metadata.rateLimit.resetTokens],
    [
      metadata.rateLimit.remainingProjectTokens,
      metadata.rateLimit.resetProjectTokens,
    ],
  ];
  const delays = buckets.flatMap(([remaining, reset]) => {
    const remainingValue = Number.parseFloat(remaining ?? '');
    if (!Number.isFinite(remainingValue) || remainingValue > 0 || !reset) {
      return [];
    }
    const parsed = parseRateLimitResetMs(reset);
    return parsed === null ? [] : [parsed];
  });
  return delays.length > 0 ? Math.max(...delays) : null;
}

function parseRateLimitResetMs(value: string): number | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  const unitMs: Record<string, number> = {
    ms: 1,
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
  };
  const pattern = /([0-9]+(?:\.[0-9]+)?)(ms|s|m|h)/g;
  let cursor = 0;
  let totalMs = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(normalized)) !== null) {
    if (match.index !== cursor) return null;
    totalMs += Number.parseFloat(match[1]) * unitMs[match[2]];
    cursor = pattern.lastIndex;
  }
  return cursor === normalized.length && cursor > 0
    ? Math.max(0, Math.round(totalMs))
    : null;
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

function safeValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, 120);
}

function defaultSleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
