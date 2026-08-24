import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalFixtureFallbackInput,
  providerFallbackWarning,
} from './providerFallbackPolicy.ts';

test('LIVE fallback always selects the canonical success fixture', () => {
  const input = {
    imageUrls: ['one', 'two'],
    demoScenarioKey: 'LOW_QUALITY_RECAPTURE',
  };

  assert.deepEqual(canonicalFixtureFallbackInput(input), {
    imageUrls: ['one', 'two'],
    demoScenarioKey: null,
  });
  assert.equal(input.demoScenarioKey, 'LOW_QUALITY_RECAPTURE');
});

test('maps structured provider failures to stable fallback warnings', () => {
  assert.equal(
    providerFallbackWarning({ kind: 'RATE_LIMIT' }).code,
    'AI_PROVIDER_RATE_LIMIT',
  );
  assert.equal(
    providerFallbackWarning({ kind: 'QUOTA_EXHAUSTED' }).code,
    'AI_PROVIDER_QUOTA_EXHAUSTED',
  );
  assert.equal(
    providerFallbackWarning({ kind: 'TIMEOUT' }).code,
    'AI_PROVIDER_TIMEOUT',
  );
  assert.equal(
    providerFallbackWarning({ kind: 'QUEUE_TIMEOUT' }).code,
    'AI_PROVIDER_TIMEOUT',
  );
  assert.equal(providerFallbackWarning(null).code, 'AI_PROVIDER_ERROR');
});
