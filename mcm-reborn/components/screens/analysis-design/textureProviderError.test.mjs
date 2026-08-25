import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  isRetryableTextureCreateFailure,
  textureProviderRetryDelayMs,
  textureProviderErrorMessage,
} from './textureProviderError.ts';

test('distinguishes an operator safety cap from a Meshy transient limit', () => {
  assert.equal(
    textureProviderErrorMessage(
      'Configured daily TARGET_RETEXTURE safety limit reached',
    ),
    '이 서비스에 설정된 일일 3D 목업 생성 한도에 도달했습니다.',
  );
  assert.equal(
    textureProviderErrorMessage('Meshy API rate limit exceeded'),
    'Meshy 요청이 몰려 있습니다. 잠시 후 다시 시도해 주세요.',
  );
  assert.equal(
    textureProviderErrorMessage('Meshy API concurrent task limit reached'),
    'Meshy 요청이 몰려 있습니다. 잠시 후 다시 시도해 주세요.',
  );
});

test('keeps credit and feature errors distinct', () => {
  assert.equal(
    textureProviderErrorMessage('Meshy API credits are insufficient'),
    'Meshy API credits가 부족합니다.',
  );
  assert.equal(
    textureProviderErrorMessage(
      'TARGET_RETEXTURE processing is not enabled for this deployment',
    ),
    '3D 목업 생성 기능이 활성화되지 않았습니다.',
  );
});

test('preserves an unknown safe application message', () => {
  assert.equal(
    textureProviderErrorMessage('3D provider unavailable'),
    '3D provider unavailable',
  );
  assert.equal(
    textureProviderErrorMessage(''),
    '3D 목업을 생성하지 못했습니다.',
  );
});

test('keeps internal recovery diagnostics out of customer UI', () => {
  const diagnostics = [
    'Meshy API rejected the task request',
    'Meshy API rejected the request',
    'Meshy task submission outcome is unknown; retry is locked to prevent duplicate billing',
    'This texture request already has a recovery reservation',
    'Texture response recovery could not be reserved',
    'Texture request cleanup failed; retry is locked to prevent duplicate billing',
    'Stored Meshy task receipt is invalid',
  ];

  for (const diagnostic of diagnostics) {
    assert.equal(
      textureProviderErrorMessage(diagnostic),
      '3D 목업을 생성하지 못했습니다.',
    );
  }
});

test('enables another create only for an explicitly retryable response', () => {
  assert.equal(isRetryableTextureCreateFailure({ retryable: true }), true);
  assert.equal(isRetryableTextureCreateFailure({ retryable: false }), false);
  assert.equal(isRetryableTextureCreateFailure({}), false);
});

test('uses a bounded provider retry delay when available', () => {
  assert.equal(textureProviderRetryDelayMs({ retryAfterMs: 0 }, 3_000), 3_000);
  assert.equal(textureProviderRetryDelayMs({ retryAfterMs: 8_000 }, 3_000), 8_000);
  assert.equal(textureProviderRetryDelayMs({ retryAfterMs: 90_000 }, 3_000), 60_000);
  assert.equal(textureProviderRetryDelayMs({ retryAfterMs: '8000' }, 3_000), 3_000);
  assert.equal(textureProviderRetryDelayMs({}, 3_000), 3_000);
});

test('submits required target retexture before optional source model', () => {
  const source = readFileSync(
    new URL('./TextureMockupStudio.tsx', import.meta.url),
    'utf8',
  );
  assert.ok(
    source.indexOf('requestJob("TARGET_RETEXTURE")') <
      source.indexOf('requestJob("SOURCE_MODEL")'),
  );
});

test('keeps ambiguous create failures terminal and retries polling 429 in place', () => {
  const studio = readFileSync(
    new URL('./TextureMockupStudio.tsx', import.meta.url),
    'utf8',
  );
  const service = readFileSync(
    new URL('../../../server/texture/texturePreviewService.ts', import.meta.url),
    'utf8',
  );

  assert.match(
    service,
    /Meshy task submission outcome is unknown; retry is locked to prevent duplicate billing[\s\S]*retryable: false/,
  );
  assert.match(
    studio,
    /isRetryableTextureCreateFailure\(error\.details\)[\s\S]*continue;/,
  );
});

test('replaces terminal target-generation problems with the local demo 3D mockup', () => {
  const studio = readFileSync(
    new URL('./TextureMockupStudio.tsx', import.meta.url),
    'utf8',
  );
  const viewer = readFileSync(
    new URL('./MockupViewer.tsx', import.meta.url),
    'utf8',
  );
  const composer = readFileSync(
    new URL('./compose-exterior-atlas.ts', import.meta.url),
    'utf8',
  );

  assert.match(
    studio,
    /AI 3D 목업 생성에 문제가 있어 데모 3D 목업으로 대체했습니다\./,
  );
  assert.match(
    studio,
    /if \(jobKind === "TARGET_RETEXTURE"\) \{\s*activateDemoMockup\(\);/,
  );
  assert.match(
    studio,
    /state === "error" && textureBlob[\s\S]*activateDemoMockup\(\)/,
  );
  assert.match(
    studio,
    /hasRememberedDemoMockup\(analysisId\)/,
  );
  assert.match(
    studio,
    /demoFallbackActiveRef\.current = true[\s\S]*setViewerReady\(modelReadyAnalysisRef\.current === analysisId\)/,
  );
  assert.match(
    studio,
    /setViewerReady\(false\);\s*clearDemoMockup\(\);\s*setTextureBlob\(composedAtlas\)/,
  );
  assert.match(
    studio,
    /signal: AbortSignal\.timeout\(MESHY_POLL_REQUEST_TIMEOUT_MS\)/,
  );
  assert.match(
    studio,
    /signal: AbortSignal\.timeout\(TEXTURE_ASSET_REQUEST_TIMEOUT_MS\)/,
  );
  assert.match(
    studio,
    /signal: AbortSignal\.timeout\(TEXTURE_DOWNLOAD_TIMEOUT_MS\)/,
  );
  assert.match(
    viewer,
    /withTimeout\([\s\S]*TEXTURE_APPLICATION_TIMEOUT_MS/,
  );
  assert.match(
    composer,
    /signal: AbortSignal\.timeout\(MATERIAL_ASSET_TIMEOUT_MS\)/,
  );
});

test('allows an expired browser task token to recover through the server receipt', () => {
  const studio = readFileSync(
    new URL('./TextureMockupStudio.tsx', import.meta.url),
    'utf8',
  );

  assert.match(
    studio,
    /if \(taskTokenError\) \{\s*forgetMeshyTaskToken\(analysisId, jobKind\);\s*\}/,
  );
  assert.match(
    studio,
    /terminal: providerTerminal,/,
  );
});
