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
  type = 'rate_limit_error',
  headers = {},
} = {}) {
  return OpenAI.APIError.generate(
    429,
    {
      error: {
        code,
        message:
          'SENSITIVE_TEST_SENTINEL sk-test-secret signed-upload-url customer-pii',
        param: null,
        type,
      },
    },
    undefined,
    new Headers({
      authorization: 'Bearer sk-test-secret',
      cookie: 'customer-pii',
      'set-cookie': 'signed-upload-url',
      'x-request-id': 'req_test',
      ...headers,
    }),
  );
}

test.beforeEach(() => {
  resetOpenAiRequestPolicyForTests();
});

test('waits for Retry-After plus jitter and retries one transient 429', async () => {
  let calls = 0;
  let nowMs = 1_000;
  const sleeps = [];
  const requestOptions = [];
  const result = await runOpenAiStage({
    stage: 'FINAL_ANALYSIS',
    maxAttempts: 2,
    deadlineAtMs: 20_000,
    now: () => nowMs,
    random: () => 0,
    createClientRequestId: () => `client_${calls + 1}`,
    sleep: async (delayMs) => {
      sleeps.push(delayMs);
      nowMs += delayMs;
    },
    call: async (options) => {
      calls += 1;
      requestOptions.push(options);
      if (calls === 1) {
        throw rateLimitError({
          headers: {
            'retry-after': '1.5',
            'x-ratelimit-remaining-tokens': '0',
          },
        });
      }
      return 'ok';
    },
  });

  assert.equal(result, 'ok');
  assert.equal(calls, 2);
  assert.deepEqual(sleeps, [1_600]);
  assert.deepEqual(
    requestOptions.map(({ attempt, clientRequestId }) => ({
      attempt,
      clientRequestId,
    })),
    [
      { attempt: 1, clientRequestId: 'client_1' },
      { attempt: 2, clientRequestId: 'client_2' },
    ],
  );
});

test('does not retry quota, billing, spend, or usage exhaustion', async (t) => {
  const markers = [
    'credit_balance_exhausted',
    'organization_spend_limit_exceeded',
    'project_spend_limit_exceeded',
    'organization_usage_limit_exceeded',
    'project_usage_limit_exceeded',
    'insufficient_quota',
    'billing_hard_limit_reached',
    'usage_limit_reached',
  ];

  for (const marker of markers) {
    await t.test(marker, async () => {
      resetOpenAiRequestPolicyForTests();
      let calls = 0;
      await assert.rejects(
        runOpenAiStage({
          stage: 'FINAL_ANALYSIS',
          maxAttempts: 2,
          deadlineAtMs: Date.now() + 20_000,
          call: async () => {
            calls += 1;
            throw rateLimitError({ code: marker });
          },
        }),
        (error) => {
          assert.ok(error instanceof OpenAiProviderExecutionError);
          assert.equal(error.metadata.kind, 'QUOTA_EXHAUSTED');
          assert.equal(error.metadata.attempts, 1);
          return true;
        },
      );
      assert.equal(calls, 1);
    });
  }

  await t.test('quota marker in type', async () => {
    resetOpenAiRequestPolicyForTests();
    let calls = 0;
    await assert.rejects(
      runOpenAiStage({
        stage: 'FINAL_ANALYSIS',
        maxAttempts: 2,
        deadlineAtMs: Date.now() + 20_000,
        call: async () => {
          calls += 1;
          throw rateLimitError({ code: null, type: 'insufficient_quota' });
        },
      }),
      (error) => {
        assert.ok(error instanceof OpenAiProviderExecutionError);
        assert.equal(error.metadata.kind, 'QUOTA_EXHAUSTED');
        return true;
      },
    );
    assert.equal(calls, 1);
  });
});

test('keeps concurrent analyses FIFO and releases the queue after failure', async () => {
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
    order.push('first-failed');
    active -= 1;
    throw new Error('expected test failure');
  }).catch(() => undefined);
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
  assert.deepEqual(order, ['first-start', 'first-failed', 'second-start']);
});

test('a terminal lookup 429 leaves a cooldown for the next stage', async () => {
  let nowMs = 1_000;
  const sleeps = [];
  await assert.rejects(
    runOpenAiStage({
      stage: 'WIKI_LOOKUP',
      maxAttempts: 1,
      deadlineAtMs: 20_000,
      now: () => nowMs,
      random: () => 0,
      sleep: async (delayMs) => {
        sleeps.push(delayMs);
        nowMs += delayMs;
      },
      call: async () => {
        throw rateLimitError({ headers: { 'retry-after': '2' } });
      },
    }),
    OpenAiProviderExecutionError,
  );

  const result = await runOpenAiStage({
    stage: 'FINAL_ANALYSIS',
    maxAttempts: 1,
    deadlineAtMs: 20_000,
    now: () => nowMs,
    random: () => 0,
    sleep: async (delayMs) => {
      sleeps.push(delayMs);
      nowMs += delayMs;
    },
    call: async () => 'ok',
  });

  assert.equal(result, 'ok');
  assert.deepEqual(sleeps, [2_100]);
});

test('does not retry when Retry-After cannot fit the deadline', async () => {
  let calls = 0;
  let sleeps = 0;
  await assert.rejects(
    runOpenAiStage({
      stage: 'FINAL_ANALYSIS',
      maxAttempts: 2,
      deadlineAtMs: 10_000,
      now: () => 1_000,
      random: () => 0,
      sleep: async () => {
        sleeps += 1;
      },
      call: async () => {
        calls += 1;
        throw rateLimitError({ headers: { 'retry-after': '60' } });
      },
    }),
    (error) => {
      assert.ok(error instanceof OpenAiProviderExecutionError);
      assert.equal(error.metadata.retryAfterMs, 60_000);
      assert.equal(error.metadata.attempts, 1);
      return true;
    },
  );
  assert.equal(calls, 1);
  assert.equal(sleeps, 0);
});

test('uses the injected clock for HTTP-date Retry-After', async () => {
  const nowMs = Date.parse('2026-08-24T00:00:00.000Z');
  await assert.rejects(
    runOpenAiStage({
      stage: 'WIKI_LOOKUP',
      maxAttempts: 1,
      deadlineAtMs: nowMs + 20_000,
      now: () => nowMs,
      random: () => 0,
      call: async () => {
        throw rateLimitError({
          headers: {
            'retry-after': new Date(nowMs + 5_000).toUTCString(),
          },
        });
      },
    }),
    (error) => {
      assert.ok(error instanceof OpenAiProviderExecutionError);
      assert.equal(error.metadata.retryAfterMs, 5_000);
      return true;
    },
  );
});

test('second 429 returns only allowlisted diagnostic metadata', async () => {
  let calls = 0;
  let nowMs = 1_000;
  await assert.rejects(
    runOpenAiStage({
      stage: 'FINAL_ANALYSIS',
      maxAttempts: 2,
      deadlineAtMs: 20_000,
      now: () => nowMs,
      random: () => 0,
      createClientRequestId: () => 'client_test',
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
            'x-ratelimit-limit-project-tokens': '25000',
            'x-ratelimit-remaining-project-tokens': '0',
            'x-ratelimit-reset-project-tokens': '2m',
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
        type: 'rate_limit_error',
        requestId: 'req_test',
        clientRequestId: 'client_test',
        retryAfterMs: 1_000,
        attempts: 2,
        elapsedMs: 1_100,
        rateLimit: {
          limitRequests: '500',
          remainingRequests: '0',
          resetRequests: '1s',
          limitTokens: '30000',
          remainingTokens: '0',
          resetTokens: '1m',
          limitProjectTokens: '25000',
          remainingProjectTokens: '0',
          resetProjectTokens: '2m',
        },
      });
      const serialized = JSON.stringify(error.metadata);
      for (const sensitive of [
        'SENSITIVE_TEST_SENTINEL',
        'sk-test-secret',
        'signed-upload-url',
        'customer-pii',
        'authorization',
        'cookie',
        'set-cookie',
      ]) {
        assert.equal(serialized.includes(sensitive), false);
      }
      assert.equal(error.message, 'OPENAI_FINAL_ANALYSIS_RATE_LIMIT');
      return true;
    },
  );
  assert.equal(calls, 2);
});
