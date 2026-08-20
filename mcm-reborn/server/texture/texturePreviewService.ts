import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  ConflictError,
  ForbiddenError,
  RateLimitError,
  ServiceUnavailableError,
  ValidationError,
} from "@/contracts/errors";
import {
  TEXTURE_PRIVACY_NOTICE_VERSION,
  type ExternalTextureProvider,
  type MeshyTaskKind,
  type MeshyTextureTaskResponse,
  type TextureJobKind,
  type TexturePreviewCreateResponse,
  type TextureProviderCapabilities,
} from "@/lib/texture-preview";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import {
  getAnalysisById,
  type AnalysisViewer,
} from "@/server/analyses/analysisService";
import {
  ExteriorMaterialClassifier,
  ExteriorMaterialPlanSchema,
  isExteriorMaterialClassifierConfigured,
} from "./ExteriorMaterialClassifier";
import {
  MeshyRetextureProvider,
  isMeshyPollingConfigured,
  isMeshyRetextureConfigured,
} from "./MeshyRetextureProvider";
import {
  MeshySourceModelProvider,
  isMeshySourceModelConfigured,
} from "./MeshySourceModelProvider";
import { getAnalysisSourceImageUrls } from "./analysisSourceImages";

const TEXTURE_OPERATION = "createTexturePreview";
const TEXTURE_DAILY_QUOTA_OPERATION = "createTexturePreviewDailyQuota";
const MAX_DAILY_REQUESTS_PER_PROVIDER = 3;
const MAX_GLOBAL_DAILY_REQUESTS_PER_PROVIDER = 5;
const MAX_DAILY_SOURCE_MODEL_REQUESTS = 1;
const MAX_GLOBAL_DAILY_SOURCE_MODEL_REQUESTS = 2;
const TASK_TOKEN_TTL_MS = 72 * 60 * 60 * 1000;
const MESHY_POLL_CACHE_TTL_MS = 2_500;
const MAX_POLL_CACHE_ENTRIES = 1_000;

type TextureIdempotencyRow = {
  key: string;
  operation: string;
  request_hash: string;
  resource_id: string | null;
  response_body: unknown;
  response_status: number | null;
  user_id: string;
};

type PollCacheEntry = {
  expiresAt: number;
  promise: Promise<MeshyTextureTaskResponse>;
};

type DailyQuotaReservation = {
  customerId: string;
  globalQuotaKey: string;
  requestHash: string;
  userQuotaKey: string;
};

const meshyPollCache = new Map<string, PollCacheEntry>();

const TexturePreviewCreateResponseSchema = z.discriminatedUnion("kind", [
  z.object({
    jobKind: z.literal("EXTERIOR_PLAN"),
    kind: z.literal("plan"),
    plan: ExteriorMaterialPlanSchema,
    provider: z.literal("OPENAI"),
  }),
  z.object({
    jobKind: z.enum(["SOURCE_MODEL", "TARGET_RETEXTURE"]),
    kind: z.literal("task"),
    progress: z.number().min(0).max(100),
    provider: z.literal("MESHY"),
    status: z.literal("queued"),
    taskToken: z.string().min(16).max(1024),
  }),
]);

const MeshyTaskTokenPayloadSchema = z.object({
  analysisId: z.string().uuid(),
  expiresAt: z.number().int().positive(),
  jobKind: z.enum(["SOURCE_MODEL", "TARGET_RETEXTURE"]),
  taskId: z.string().trim().min(1).max(160),
  userId: z.string().uuid(),
});

export type CreateTexturePreviewInput = {
  analysisId: string;
  externalAiProcessingConsentAccepted: true;
  idempotencyKey: string;
  jobKind: TextureJobKind;
  privacyNoticeVersion: typeof TEXTURE_PRIVACY_NOTICE_VERSION;
};

export function getTextureProviderCapabilities(): TextureProviderCapabilities {
  const enabled = process.env.ENABLE_TEXTURE_AI === "true";
  const features = {
    exteriorPlan: enabled && isExteriorMaterialClassifierConfigured(),
    sourceModel:
      enabled &&
      process.env.ENABLE_MESHY_SOURCE_MODEL === "true" &&
      isMeshySourceModelConfigured() &&
      isMeshyTaskSigningConfigured(),
    targetRetexture:
      enabled &&
      isMeshyRetextureConfigured() &&
      isMeshyTaskSigningConfigured(),
  };
  const providers = {
    MESHY: features.sourceModel || features.targetRetexture,
    OPENAI: features.exteriorPlan,
  };
  return {
    enabled: providers.MESHY || providers.OPENAI,
    features,
    privacyNoticeVersion: TEXTURE_PRIVACY_NOTICE_VERSION,
    providers,
  };
}

export async function createTexturePreview(
  input: CreateTexturePreviewInput,
  viewer: AnalysisViewer,
): Promise<TexturePreviewCreateResponse> {
  await getAnalysisById(input.analysisId, viewer);
  assertExternalTextureConsent(input);
  assertJobEnabled(input.jobKind);
  const sourceImages = await getAnalysisSourceImageUrls(input.analysisId);
  const provider = providerForJob(input.jobKind);
  const admin = createAdminSupabaseClient();
  const reservation = await reserveTextureOperation(
    admin,
    input,
    viewer.id,
    provider,
    sourceImages.assetIds,
  );
  if (reservation.cachedResponse) return reservation.cachedResponse;

  let quotaReservation: DailyQuotaReservation | null = null;
  try {
    quotaReservation = await reserveDailyTextureBudget(
      admin,
      input,
      viewer.id,
      reservation.requestHash,
    );
    await recordTextureConsent(admin, input, viewer.id, reservation.requestHash);
  } catch (error) {
    await releaseDailyTextureBudget(admin, quotaReservation);
    await releaseTextureOperation(
      admin,
      reservation.storageKey,
      reservation.requestHash,
      viewer.id,
    );
    throw error;
  }

  let response: TexturePreviewCreateResponse;
  try {
    if (input.jobKind === "EXTERIOR_PLAN") {
      response = {
        jobKind: "EXTERIOR_PLAN",
        kind: "plan",
        plan: await new ExteriorMaterialClassifier().classify(
          sourceImages.imageUrls.map((signedUrl, index) => ({
            signedUrl,
            view: (["FRONT", "RIGHT", "REAR", "LEFT"] as const)[index],
          })),
        ),
        provider: "OPENAI",
      };
    } else {
      response = await createMeshyTaskResponse(
        input.analysisId,
        viewer.id,
        input.jobKind,
        sourceImages.imageUrls,
      );
    }
  } catch (error) {
    await storeTextureOperationFailure(
      admin,
      reservation.storageKey,
      reservation.requestHash,
      viewer.id,
    );
    throw error;
  }

  try {
    await storeTextureOperationSuccess(
      admin,
      reservation.storageKey,
      reservation.requestHash,
      viewer.id,
      response,
      quotaReservation,
    );
  } catch {
    console.error("[TexturePreview] Failed to cache provider success");
  }
  return response;
}

export async function getMeshyTextureTask(
  analysisId: string,
  taskToken: string,
  viewer: AnalysisViewer,
): Promise<MeshyTextureTaskResponse> {
  await getAnalysisById(analysisId, viewer);
  assertMeshyPollingAvailable();
  const payload = verifyMeshyTaskToken(taskToken);
  if (payload.analysisId !== analysisId || payload.userId !== viewer.id) {
    throw new ForbiddenError("This texture task does not belong to the viewer");
  }
  return getCachedMeshyTask(payload.taskId, payload.jobKind, viewer.id);
}

function assertExternalTextureConsent(input: CreateTexturePreviewInput) {
  if (
    input.externalAiProcessingConsentAccepted !== true ||
    input.privacyNoticeVersion !== TEXTURE_PRIVACY_NOTICE_VERSION
  ) {
    throw new ForbiddenError(
      "External AI texture processing consent is required for the active notice",
    );
  }
}

function assertJobEnabled(jobKind: TextureJobKind) {
  const capabilities = getTextureProviderCapabilities();
  const enabled =
    jobKind === "EXTERIOR_PLAN"
      ? capabilities.features.exteriorPlan
      : jobKind === "SOURCE_MODEL"
        ? capabilities.features.sourceModel
        : capabilities.features.targetRetexture;
  if (!capabilities.enabled || !enabled) {
    throw new ServiceUnavailableError(
      `${jobKind} processing is not enabled for this deployment`,
      { retryable: false },
    );
  }
}

async function reserveTextureOperation(
  admin: SupabaseClient,
  input: CreateTexturePreviewInput,
  customerId: string,
  provider: ExternalTextureProvider,
  sourceAssetIds: readonly string[],
) {
  const storageKey = createHash("sha256")
    .update(
      `${customerId}:${TEXTURE_OPERATION}:${provider}:${input.jobKind}:${input.analysisId}`,
    )
    .digest("hex");
  const sourceAssetDigest = createHash("sha256")
    .update(sourceAssetIds.join(":"))
    .digest("hex");
  const requestHash = createHash("sha256")
    .update(
      JSON.stringify({
        analysisId: input.analysisId,
        customerId,
        idempotencyKey: input.idempotencyKey,
        jobKind: input.jobKind,
        operation: TEXTURE_OPERATION,
        privacyNoticeVersion: input.privacyNoticeVersion,
        provider,
        sourceAssetDigest,
      }),
    )
    .digest("hex");

  const { error } = await admin.from("idempotency_keys").insert({
    key: storageKey,
    operation: TEXTURE_OPERATION,
    request_hash: requestHash,
    resource_id: input.analysisId,
    user_id: customerId,
  });
  if (!error) {
    return { cachedResponse: null, requestHash, storageKey };
  }
  if (error.code !== "23505") {
    throw new ServiceUnavailableError("Texture request could not be reserved");
  }

  const { data: existing, error: readError } = await admin
    .from("idempotency_keys")
    .select(
      "key,user_id,operation,resource_id,request_hash,response_status,response_body",
    )
    .eq("key", storageKey)
    .maybeSingle();
  if (readError || !existing) {
    throw new ServiceUnavailableError("Texture request could not be recovered");
  }

  const row = existing as unknown as TextureIdempotencyRow;
  if (
    row.user_id !== customerId ||
    row.operation !== TEXTURE_OPERATION ||
    row.resource_id !== input.analysisId ||
    row.request_hash !== requestHash
  ) {
    throw new ConflictError(
      "TEXTURE_PROVIDER_LIMIT_REACHED",
      "Only one paid texture request per job and analysis is allowed in the demo",
    );
  }

  const cached = TexturePreviewCreateResponseSchema.safeParse(row.response_body);
  if (
    (row.response_status === 200 || row.response_status === 202) &&
    cached.success
  ) {
    return {
      cachedResponse: cached.data as TexturePreviewCreateResponse,
      requestHash,
      storageKey,
    };
  }
  if (row.response_status === null) {
    const recovered = await readQuotaCachedTextureResponse(
      admin,
      customerId,
      requestHash,
    );
    if (recovered) {
      try {
        await storeTextureOperationSuccess(
          admin,
          storageKey,
          requestHash,
          customerId,
          recovered,
        );
      } catch {
        console.error("[TexturePreview] Failed to restore primary response cache");
      }
      return { cachedResponse: recovered, requestHash, storageKey };
    }
    throw new ConflictError(
      "TEXTURE_REQUEST_IN_PROGRESS",
      "This texture request is already in progress",
    );
  }
  throw new ConflictError(
    "TEXTURE_REQUEST_PREVIOUSLY_FAILED",
    "The previous paid texture request did not complete; an operator must reset it before retrying",
  );
}

async function readQuotaCachedTextureResponse(
  admin: SupabaseClient,
  customerId: string,
  requestHash: string,
) {
  const { data, error } = await admin
    .from("idempotency_keys")
    .select("response_body,response_status")
    .eq("user_id", customerId)
    .eq("operation", TEXTURE_DAILY_QUOTA_OPERATION)
    .eq("request_hash", requestHash)
    .in("response_status", [200, 202])
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const parsed = TexturePreviewCreateResponseSchema.safeParse(data.response_body);
  return parsed.success
    ? (parsed.data as TexturePreviewCreateResponse)
    : null;
}

async function storeTextureOperationSuccess(
  admin: SupabaseClient,
  storageKey: string,
  requestHash: string,
  customerId: string,
  response: TexturePreviewCreateResponse,
  quotaReservation: DailyQuotaReservation | null = null,
) {
  const responseStatus = response.kind === "task" ? 202 : 200;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await admin
      .from("idempotency_keys")
      .update({ response_body: response, response_status: responseStatus })
      .eq("key", storageKey)
      .eq("user_id", customerId)
      .eq("operation", TEXTURE_OPERATION)
      .eq("request_hash", requestHash)
      .is("response_status", null)
      .select("key")
      .maybeSingle();
    if (!error && data?.key === storageKey) return;
    if (attempt < 2) await waitForDatabaseRetry(100 * (attempt + 1));
  }

  if (quotaReservation) {
    const { data, error } = await admin
      .from("idempotency_keys")
      .update({ response_body: response, response_status: responseStatus })
      .eq("key", quotaReservation.globalQuotaKey)
      .eq("user_id", customerId)
      .eq("operation", TEXTURE_DAILY_QUOTA_OPERATION)
      .eq("request_hash", requestHash)
      .is("response_status", null)
      .select("key")
      .maybeSingle();
    if (!error && data?.key === quotaReservation.globalQuotaKey) return;
  }

  throw new ServiceUnavailableError("Texture response could not be cached");
}

async function reserveDailyTextureBudget(
  admin: SupabaseClient,
  input: CreateTexturePreviewInput,
  customerId: string,
  requestHash: string,
): Promise<DailyQuotaReservation> {
  const utcDate = new Date().toISOString().slice(0, 10);
  const provider = providerForJob(input.jobKind);
  const userLimit =
    input.jobKind === "SOURCE_MODEL"
      ? MAX_DAILY_SOURCE_MODEL_REQUESTS
      : MAX_DAILY_REQUESTS_PER_PROVIDER;
  const globalLimit =
    input.jobKind === "SOURCE_MODEL"
      ? MAX_GLOBAL_DAILY_SOURCE_MODEL_REQUESTS
      : MAX_GLOBAL_DAILY_REQUESTS_PER_PROVIDER;
  const userQuotaKey = await claimDailyQuotaSlot(
    admin,
    `${customerId}:${provider}:${input.jobKind}:${utcDate}`,
    userLimit,
    input,
    customerId,
    requestHash,
  );
  try {
    const globalQuotaKey = await claimDailyQuotaSlot(
      admin,
      `GLOBAL:${provider}:${input.jobKind}:${utcDate}`,
      globalLimit,
      input,
      customerId,
      requestHash,
    );
    return { customerId, globalQuotaKey, requestHash, userQuotaKey };
  } catch (error) {
    await releaseQuotaKeys(admin, [userQuotaKey], customerId, requestHash);
    throw error;
  }
}

async function claimDailyQuotaSlot(
  admin: SupabaseClient,
  scope: string,
  limit: number,
  input: CreateTexturePreviewInput,
  customerId: string,
  requestHash: string,
) {
  for (let slot = 0; slot < limit; slot += 1) {
    const quotaKey = createHash("sha256")
      .update(`${TEXTURE_DAILY_QUOTA_OPERATION}:${scope}:${slot}`)
      .digest("hex");
    const { error } = await admin.from("idempotency_keys").insert({
      key: quotaKey,
      operation: TEXTURE_DAILY_QUOTA_OPERATION,
      request_hash: requestHash,
      resource_id: input.analysisId,
      user_id: customerId,
    });
    if (!error) return quotaKey;
    if (error.code !== "23505") {
      throw new ServiceUnavailableError("Texture usage limit is unavailable");
    }
  }
  throw new RateLimitError(
    `Daily ${input.jobKind} preview limit reached`,
  );
}

async function releaseDailyTextureBudget(
  admin: SupabaseClient,
  reservation: DailyQuotaReservation | null,
) {
  if (!reservation) return;
  await releaseQuotaKeys(
    admin,
    [reservation.userQuotaKey, reservation.globalQuotaKey],
    reservation.customerId,
    reservation.requestHash,
  );
}

async function releaseQuotaKeys(
  admin: SupabaseClient,
  keys: string[],
  customerId: string,
  requestHash: string,
) {
  const { error } = await admin
    .from("idempotency_keys")
    .delete()
    .in("key", keys)
    .eq("user_id", customerId)
    .eq("operation", TEXTURE_DAILY_QUOTA_OPERATION)
    .eq("request_hash", requestHash)
    .is("response_status", null);
  if (error) {
    console.error("[TexturePreview] Failed to release unused quota");
  }
}

async function releaseTextureOperation(
  admin: SupabaseClient,
  storageKey: string,
  requestHash: string,
  customerId: string,
) {
  const { error } = await admin
    .from("idempotency_keys")
    .delete()
    .eq("key", storageKey)
    .eq("user_id", customerId)
    .eq("operation", TEXTURE_OPERATION)
    .eq("request_hash", requestHash)
    .is("response_status", null);
  if (error) {
    console.error("[TexturePreview] Failed to release unused reservation");
  }
}

async function storeTextureOperationFailure(
  admin: SupabaseClient,
  storageKey: string,
  requestHash: string,
  customerId: string,
) {
  const { error } = await admin
    .from("idempotency_keys")
    .update({
      response_body: { error: "TEXTURE_PROVIDER_REQUEST_FAILED" },
      response_status: 502,
    })
    .eq("key", storageKey)
    .eq("user_id", customerId)
    .eq("operation", TEXTURE_OPERATION)
    .eq("request_hash", requestHash)
    .is("response_status", null);
  if (error) {
    console.error("[TexturePreview] Failed to cache provider failure");
  }
}

async function recordTextureConsent(
  admin: SupabaseClient,
  input: CreateTexturePreviewInput,
  customerId: string,
  requestHash: string,
) {
  let consentId = randomUUID();
  const { error: insertError } = await admin
    .from("analysis_external_ai_consents")
    .insert({
      accepted_at: new Date().toISOString(),
      customer_id: customerId,
      id: consentId,
      privacy_notice_version: input.privacyNoticeVersion,
      request_hash: requestHash,
    });
  if (insertError?.code === "23505") {
    const { data: existing, error: readError } = await admin
      .from("analysis_external_ai_consents")
      .select("id,analysis_id")
      .eq("customer_id", customerId)
      .eq("request_hash", requestHash)
      .maybeSingle();
    if (readError || !existing) {
      throw new ServiceUnavailableError("Texture consent could not be recovered");
    }
    if (existing.analysis_id === input.analysisId) return;
    if (existing.analysis_id !== null) {
      throw new ConflictError(
        "TEXTURE_REQUEST_ALREADY_USED",
        "This texture request has already been submitted",
      );
    }
    consentId = existing.id;
  }
  if (insertError && insertError.code !== "23505") {
    throw new ServiceUnavailableError("Texture consent could not be recorded");
  }

  const { data: linked, error: linkError } = await admin
    .from("analysis_external_ai_consents")
    .update({ analysis_id: input.analysisId })
    .eq("id", consentId)
    .eq("customer_id", customerId)
    .is("analysis_id", null)
    .select("id")
    .maybeSingle();
  if (linkError || linked?.id !== consentId) {
    throw new ServiceUnavailableError("Texture consent could not be linked");
  }
}

async function createMeshyTaskResponse(
  analysisId: string,
  userId: string,
  jobKind: MeshyTaskKind,
  imageUrls: readonly string[],
): Promise<TexturePreviewCreateResponse> {
  const { taskId } =
    jobKind === "SOURCE_MODEL"
      ? await new MeshySourceModelProvider().createTask(imageUrls)
      : await new MeshyRetextureProvider().createTask(imageUrls);
  return {
    jobKind,
    kind: "task",
    progress: 0,
    provider: "MESHY",
    status: "queued",
    taskToken: createMeshyTaskToken({ analysisId, jobKind, taskId, userId }),
  };
}

function assertMeshyPollingAvailable() {
  if (!isMeshyPollingConfigured() || !isMeshyTaskSigningConfigured()) {
    throw new ServiceUnavailableError("Meshy task polling is unavailable", {
      retryable: false,
    });
  }
}

async function getCachedMeshyTask(
  taskId: string,
  jobKind: MeshyTaskKind,
  userId: string,
) {
  const now = Date.now();
  for (const [key, entry] of meshyPollCache) {
    if (entry.expiresAt <= now) meshyPollCache.delete(key);
  }
  if (meshyPollCache.size >= MAX_POLL_CACHE_ENTRIES) {
    meshyPollCache.delete(meshyPollCache.keys().next().value ?? "");
  }

  const cacheKey = createHash("sha256")
    .update(`${userId}:${jobKind}:${taskId}`)
    .digest("hex");
  const cached = meshyPollCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.promise;

  const promise =
    jobKind === "SOURCE_MODEL"
      ? new MeshySourceModelProvider().getTask(taskId)
      : new MeshyRetextureProvider().getTask(taskId);
  meshyPollCache.set(cacheKey, {
    expiresAt: Number.POSITIVE_INFINITY,
    promise,
  });
  try {
    const result = await promise;
    meshyPollCache.set(cacheKey, {
      expiresAt: Date.now() + MESHY_POLL_CACHE_TTL_MS,
      promise: Promise.resolve(result),
    });
    return result;
  } catch (error) {
    meshyPollCache.delete(cacheKey);
    throw error;
  }
}

function createMeshyTaskToken(input: {
  analysisId: string;
  jobKind: MeshyTaskKind;
  taskId: string;
  userId: string;
}) {
  const payload = Buffer.from(
    JSON.stringify({
      ...input,
      expiresAt: Date.now() + TASK_TOKEN_TTL_MS,
    }),
  ).toString("base64url");
  return `${payload}.${signTaskPayload(payload)}`;
}

function providerForJob(jobKind: TextureJobKind): ExternalTextureProvider {
  return jobKind === "EXTERIOR_PLAN" ? "OPENAI" : "MESHY";
}

function verifyMeshyTaskToken(token: string) {
  if (token.length > 1024) {
    throw new ValidationError("Texture task token is invalid");
  }
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) {
    throw new ValidationError("Texture task token is invalid");
  }

  const expected = Buffer.from(signTaskPayload(payload), "base64url");
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    throw new ValidationError("Texture task token is invalid");
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new ForbiddenError("Texture task token signature is invalid");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new ValidationError("Texture task token is invalid");
  }
  const parsed = MeshyTaskTokenPayloadSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new ValidationError("Texture task token is invalid");
  }
  if (parsed.data.expiresAt <= Date.now()) {
    throw new ForbiddenError("Texture task token has expired");
  }
  return parsed.data;
}

function signTaskPayload(payload: string) {
  const key = process.env.TEXTURE_TASK_SIGNING_SECRET?.trim();
  if (!key) {
    throw new ServiceUnavailableError("Meshy task signing is unavailable", {
      retryable: false,
    });
  }
  return createHmac("sha256", key).update(payload).digest("base64url");
}

function isMeshyTaskSigningConfigured() {
  const secret = process.env.TEXTURE_TASK_SIGNING_SECRET?.trim();
  return Boolean(secret && secret.length >= 32);
}

function waitForDatabaseRetry(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
