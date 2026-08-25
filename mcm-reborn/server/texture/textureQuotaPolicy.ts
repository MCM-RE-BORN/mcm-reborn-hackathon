export type TextureQuotaJobKind =
  | 'EXTERIOR_PLAN'
  | 'SOURCE_MODEL'
  | 'TARGET_RETEXTURE';

export type TextureDailyQuotaPolicy = {
  globalLimit: number | null;
  userLimit: number | null;
};

export const TARGET_RETEXTURE_GLOBAL_DAILY_LIMIT_ENV =
  'MESHY_TARGET_RETEXTURE_GLOBAL_DAILY_LIMIT';
export const TARGET_RETEXTURE_USER_DAILY_LIMIT_ENV =
  'MESHY_TARGET_RETEXTURE_DAILY_LIMIT_PER_USER';

const MAX_CONFIGURED_DAILY_LIMIT = 100;

export function resolveTextureDailyQuotaPolicy(
  jobKind: TextureQuotaJobKind,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): TextureDailyQuotaPolicy {
  if (jobKind === 'SOURCE_MODEL') {
    return { globalLimit: 2, userLimit: 1 };
  }
  if (jobKind === 'EXTERIOR_PLAN') {
    return { globalLimit: 5, userLimit: 3 };
  }
  return {
    globalLimit: readOptionalDailyLimit(
      environment[TARGET_RETEXTURE_GLOBAL_DAILY_LIMIT_ENV],
      TARGET_RETEXTURE_GLOBAL_DAILY_LIMIT_ENV,
    ),
    userLimit: readOptionalDailyLimit(
      environment[TARGET_RETEXTURE_USER_DAILY_LIMIT_ENV],
      TARGET_RETEXTURE_USER_DAILY_LIMIT_ENV,
    ),
  };
}

function readOptionalDailyLimit(
  value: string | undefined,
  variableName: string,
): number | null {
  const normalized = value?.trim();
  if (!normalized || normalized === '0') return null;
  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new Error(
      `${variableName} must be 0 or an integer from 1 to ${MAX_CONFIGURED_DAILY_LIMIT}`,
    );
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed > MAX_CONFIGURED_DAILY_LIMIT) {
    throw new Error(
      `${variableName} must be 0 or an integer from 1 to ${MAX_CONFIGURED_DAILY_LIMIT}`,
    );
  }
  return parsed;
}
