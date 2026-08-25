import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isApiFallbackAnalysis,
  visibleAnalysisWarnings,
} from './analysisFallback.ts';

function analysis(overrides = {}) {
  return {
    modeUsed: 'DEMO_FIXTURE',
    provider: { name: 'DEMO_DATA' },
    warnings: [],
    ...overrides,
  };
}

test('marks only a LIVE provider failure that fell back to demo data', () => {
  assert.equal(
    isApiFallbackAnalysis(
      analysis({
        warnings: [
          {
            code: 'AI_PROVIDER_RATE_LIMIT',
            message: 'provider fallback',
          },
        ],
      }),
    ),
    true,
  );
});

test('does not mark direct demo, seeded, or successful LIVE analyses', () => {
  assert.equal(isApiFallbackAnalysis(analysis()), false);
  assert.equal(
    isApiFallbackAnalysis(
      analysis({
        modeUsed: 'SEEDED_ESTIMATE',
        warnings: [
          { code: 'AI_PROVIDER_ERROR', message: 'provider fallback' },
        ],
      }),
    ),
    false,
  );
  assert.equal(
    isApiFallbackAnalysis(
      analysis({
        modeUsed: 'LIVE',
        provider: { name: 'OPENAI' },
        warnings: [],
      }),
    ),
    false,
  );
});

test('does not mistake unrelated warnings for provider fallback', () => {
  assert.equal(
    isApiFallbackAnalysis(
      analysis({
        warnings: [{ code: 'OTHER_WARNING', message: 'other' }],
      }),
    ),
    false,
  );
});

test('keeps unrelated warnings out of the compact provider label', () => {
  const warnings = visibleAnalysisWarnings(
    analysis({
      warnings: [
        { code: 'AI_PROVIDER_TIMEOUT', message: 'provider fallback' },
        { code: 'OTHER_WARNING', message: 'other' },
      ],
    }),
  );

  assert.deepEqual(warnings, [{ code: 'OTHER_WARNING', message: 'other' }]);
});

test('preserves provider warnings when the analysis is not a demo fallback', () => {
  const warnings = [
    { code: 'AI_PROVIDER_ERROR', message: 'future live warning' },
  ];

  assert.deepEqual(
    visibleAnalysisWarnings(
      analysis({
        modeUsed: 'LIVE',
        provider: { name: 'OPENAI' },
        warnings,
      }),
    ),
    warnings,
  );
});
