import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  isRetryableTextureCreateFailure,
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

test('enables another create only for an explicitly retryable response', () => {
  assert.equal(isRetryableTextureCreateFailure({ retryable: true }), true);
  assert.equal(isRetryableTextureCreateFailure({ retryable: false }), false);
  assert.equal(isRetryableTextureCreateFailure({}), false);
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
    /error\.status === 429[\s\S]*isRetryableTextureCreateFailure\(error\.details\)[\s\S]*continue;/,
  );
});
