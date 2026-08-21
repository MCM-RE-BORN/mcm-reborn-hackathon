import assert from 'node:assert/strict';
import test from 'node:test';
import OpenAI from 'openai';
import {
  OpenAiProviderExecutionError,
  resetOpenAiRequestPolicyForTests,
  runOpenAiStage,
  runSerializedOpenAiAnalysis,
} from './openAiRequestPolicy.ts';

function rateLimitError({
  code = 'rate_limit_exceeded',
  headers = {},
} = {}) {
  return OpenAI.APIError.generate(
    429,
    {
      error: {
        code,
        message: 'redacted test error',
        param: null,
        type: 'tokens',
      },
    },
    undefined,
    new Headers({ 'x-request-id': 'req_test', ...headers }),
  );
}

test.beforeEach(() => {
  resetOpenAiRequestPolicyForTests();
});

test('waits for Retry-After and retries one transient 429', async () => {
  let calls = 0;
  let nowMs = 1_000;
  const sleeps = [];
  const result = await runOpenAiStage({
    stage: 'FINAL_ANALYSIS',
    deadlineAtMs: 20_000,
    now: () => nowMs,
    random: () => 0,
    sleep: async (delayMs) => {
      sleeps.push(delayMs);
      nowMs += delayMs;
    },
    call: async () => {
      calls += 1;
      if (calls === 1) {
        throw rateLimitError({
          headers: {
            'retry-after-ms': '1500',
            'x-ratelimit-remaining-tokens': '0',
          },
        });
      }
      return 'ok';
    },
  });

  assert.equal(result, 'ok');
  assert.equal(calls, 2);
  assert.deepEqual(sleeps, [1_500]);
});

test('does not retry insufficient quota', async () => {
  let calls = 0;
  await assert.rejects(
    runOpenAiStage({
      stage: 'FINAL_ANALYSIS',
      deadlineAtMs: Date.now() + 20_000,
      call: async () => {
        calls += 1;
        throw rateLimitError({ code: 'insufficient_quota' });
      },
    }),
    (error) => {
      assert.ok(error instanceof OpenAiProviderExecutionError);
      assert.equal(error.metadata.kind, 'QUOTA_EXHAUSTED');
      assert.equal(error.metadata.attempts, 1);
      assert.equal(error.metadata.requestId, 'req_test');
      return true;
    },
  );
  assert.equal(calls, 1);
});

test('keeps concurrent analyses FIFO with one active operation', async () => {
  let active = 0;
  let maxActive = 0;
  const order = [];
  let releaseFirst;
  const firstBlocked = new Promise((resolve) => {
    releaseFirst = resolve;
  });
  const deadlineAtMs = Date.now() + 10_000;

  const first = runSerializedOpenAiAnalysis(deadlineAtMs, async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    order.push('first-start');
    await firstBlocked;
    order.push('first-end');
    active -= 1;
  });
  const second = runSerializedOpenAiAnalysis(deadlineAtMs, async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    order.push('second-start');
    active -= 1;
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(order, ['first-start']);
  releaseFirst();
  await Promise.all([first, second]);

  assert.equal(maxActive, 1);
  assert.deepEqual(order, ['first-start', 'first-end', 'second-start']);
});

test('second 429 returns only allowlisted diagnostic metadata', async () => {
  let calls = 0;
  let nowMs = 1_000;
  await assert.rejects(
    runOpenAiStage({
      stage: 'FINAL_ANALYSIS',
      deadlineAtMs: 20_000,
      now: () => nowMs,
      sleep: async (delayMs) => {
        nowMs += delayMs;
      },
      call: async () => {
        calls += 1;
        throw rateLimitError({
          headers: {
            'retry-after': '1',
            'x-ratelimit-limit-requests': '500',
            'x-ratelimit-remaining-requests': '0',
            'x-ratelimit-reset-requests': '1s',
            'x-ratelimit-limit-tokens': '30000',
            'x-ratelimit-remaining-tokens': '0',
            'x-ratelimit-reset-tokens': '1m',
          },
        });
      },
    }),
    (error) => {
      assert.ok(error instanceof OpenAiProviderExecutionError);
      assert.deepEqual(error.metadata, {
        stage: 'FINAL_ANALYSIS',
        kind: 'RATE_LIMIT',
        status: 429,
        code: 'rate_limit_exceeded',
        type: 'tokens',
        requestId: 'req_test',
        retryAfterMs: 1_000,
        attempts: 2,
        elapsedMs: 1_000,
        rateLimit: {
          limitRequests: '500',
          remainingRequests: '0',
          resetRequests: '1s',
          limitTokens: '30000',
          remainingTokens: '0',
          resetTokens: '1m',
        },
      });
      assert.equal(JSON.stringify(error.metadata).includes('redacted'), false);
      return true;
    },
  );
  assert.equal(calls, 2);
});
