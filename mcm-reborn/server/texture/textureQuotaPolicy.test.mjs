import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveTextureDailyQuotaPolicy,
  TARGET_RETEXTURE_GLOBAL_DAILY_LIMIT_ENV,
  TARGET_RETEXTURE_USER_DAILY_LIMIT_ENV,
} from './textureQuotaPolicy.ts';

test('target retexture has no application daily cap by default', () => {
  assert.deepEqual(resolveTextureDailyQuotaPolicy('TARGET_RETEXTURE', {}), {
    globalLimit: null,
    userLimit: null,
  });
});

test('target retexture accepts independent explicit safety caps', () => {
  assert.deepEqual(
    resolveTextureDailyQuotaPolicy('TARGET_RETEXTURE', {
      [TARGET_RETEXTURE_USER_DAILY_LIMIT_ENV]: '12',
    }),
    { globalLimit: null, userLimit: 12 },
  );
  assert.deepEqual(
    resolveTextureDailyQuotaPolicy('TARGET_RETEXTURE', {
      [TARGET_RETEXTURE_GLOBAL_DAILY_LIMIT_ENV]: '40',
      [TARGET_RETEXTURE_USER_DAILY_LIMIT_ENV]: '8',
    }),
    { globalLimit: 40, userLimit: 8 },
  );
});

test('blank and zero target limits explicitly disable each cap', () => {
  assert.deepEqual(
    resolveTextureDailyQuotaPolicy('TARGET_RETEXTURE', {
      [TARGET_RETEXTURE_GLOBAL_DAILY_LIMIT_ENV]: '0',
      [TARGET_RETEXTURE_USER_DAILY_LIMIT_ENV]: '  ',
    }),
    { globalLimit: null, userLimit: null },
  );
});

test('invalid or excessive target limits fail closed', () => {
  for (const value of ['-1', '1.5', 'abc', '101']) {
    assert.throws(
      () =>
        resolveTextureDailyQuotaPolicy('TARGET_RETEXTURE', {
          [TARGET_RETEXTURE_USER_DAILY_LIMIT_ENV]: value,
        }),
      /must be 0 or an integer from 1 to 100/,
    );
  }
});

test('source and exterior safeguards remain fixed', () => {
  const environment = {
    [TARGET_RETEXTURE_GLOBAL_DAILY_LIMIT_ENV]: '40',
    [TARGET_RETEXTURE_USER_DAILY_LIMIT_ENV]: '8',
  };
  assert.deepEqual(resolveTextureDailyQuotaPolicy('SOURCE_MODEL', environment), {
    globalLimit: 2,
    userLimit: 1,
  });
  assert.deepEqual(resolveTextureDailyQuotaPolicy('EXTERIOR_PLAN', environment), {
    globalLimit: 5,
    userLimit: 3,
  });
});
