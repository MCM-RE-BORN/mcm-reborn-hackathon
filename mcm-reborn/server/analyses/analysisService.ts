import { createHash, randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AnalysisModeUsedSchema,
  ConditionGradeSchema,
  MaterialTypeSchema,
  SourceCategorySchema,
  assertImageQualityContract,
  type AnalysisModeUsed,
  type ConditionGrade,
  type SourceCategory,
} from '@/contracts/analysis';
import {
  ConflictError,
  ForbiddenError,
  ImageQualityInsufficientError,
  NotFoundError,
  ServiceUnavailableError,
  UpstreamError,
  ValidationError,
  type AppError,
} from '@/contracts/errors';
import {
  ProductCodeSchema,
  RecommendationReasonCodeSchema,
  type ProductCode,
  type RecommendationReasonCode,
} from '@/contracts/product';
import {
  createAdminSupabaseClient,
  createUserSupabaseClient,
} from '@/lib/supabase/server';
import {
  assertExternalAiReady,
  createVisionProvider,
} from '@/server/openai/visionProviderFactory';
import { VisionImageQualityError } from '@/server/openai/types';
import { isRecord } from '@/server/http/json';
import {
  calculateCarbonSaving,
  calculateRecommendationScore,
  calculateReusableMaterial,
} from '@/server/recommendation/calculateRecommendations';

const ANALYSIS_OPERATION = 'createAnalysis';
const PROVIDER_NOTICE = {
  DEMO_FIXTURE:
    '준비된 데모 예상치이며 주문 후 전문가 실물 검수에서 변경될 수 있습니다.',
  SEEDED_ESTIMATE:
    '재현 가능한 예상치이며 주문 후 전문가 실물 검수에서 변경될 수 있습니다.',
  LIVE:
    '사진 기반 AI 예상치이며 주문 후 전문가 실물 검수에서 변경될 수 있습니다.',
} satisfies Record<AnalysisModeUsed, string>;

export type AnalysisViewer = {
  accessToken?: string;
  id: string;
  role: 'CUSTOMER' | 'OPERATOR';
};

export interface CreateAnalysisInput {
  accessToken?: string;
  customerId: string;
  imageAssetIds: string[];
  category?: SourceCategory;
  sourceCategoryHint?: SourceCategory | null;
  purchaseYear?: number;
  useDuration?: string;
  desiredUse?: string;
  serialNumber?: string | null;
  conditionNote?: string | null;
  locale: string;
  demoScenarioKey?: string | null;
  externalAiProcessingConsentAccepted?: true;
  externalAiPrivacyNoticeVersion?: string;
  idempotencyKey: string;
}

export interface AnalysisRecommendation {
  productId: string;
  productCode: ProductCode;
  eligible: boolean;
  score: number;
  estimatedReusableMaterialRate: number;
  reasonCodes: RecommendationReasonCode[];
}

export interface Analysis {
  id: string;
  status: 'COMPLETED';
  modeUsed: AnalysisModeUsed;
  sourceProduct: {
    category: SourceCategory;
    materialType: string;
    confidence: number;
  };
  condition: {
    grade: ConditionGrade;
    overallDamageSeverity: number;
    summary: string;
  };
  damages: Array<{
    type: string;
    location: string;
    severity: number;
    confidence: number;
  }>;
  imageQuality: { status: 'ACCEPTABLE'; issues: [] };
  estimateMeta: {
    mode: AnalysisModeUsed;
    confidencePercent: number;
    notice: string;
  };
  authenticityPrecheck: {
    status: 'ORDER_ELIGIBLE' | 'INELIGIBLE';
    estimatePercent: number;
    notice: string;
  };
  estimatedReusableMaterialRate: number;
  estimatedReusableAreaCm2: number;
  longStripAvailable: boolean;
  recommendations: AnalysisRecommendation[];
  esgPreview: {
    methodologyVersion: 'DEMO_LCA_V2';
    estimatedCarbonSavingKgCo2e: number;
    disclaimer: string;
  };
  provider: {
    name: 'OPENAI' | 'DEMO_DATA';
    model: string;
    requestId: string | null;
  };
  warnings: Array<{ code: string; message: string }>;
  createdAt: string;
  completedAt: string;
}

export interface AnalysisListItem {
  id: string;
  sourceCategory: SourceCategory;
  conditionGrade: ConditionGrade;
  estimatedReusableMaterialRate: number;
  estimateMeta: Analysis['estimateMeta'];
  modeUsed: AnalysisModeUsed;
  createdAt: string;
}

export interface PagedAnalyses {
  items: AnalysisListItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

type MediaAssetRow = {
  id: string;
  owner_id: string;
  bucket: string;
  path: string;
  upload_status: string;
};

type ProductRuleRow = {
  id: string;
  code: string;
  required_area_cm2: number;
};

type AnalysisRow = {
  id: string;
  customer_id: string;
  status: string;
  mode_used: string;
  source_category: string | null;
  material_type: string | null;
  condition_grade: string | null;
  damage_severity: number | null;
  summary: string | null;
  estimate_confidence_percent: number | null;
  estimate_notice: string | null;
  authenticity_precheck_status: string | null;
  authenticity_estimate_percent: number | null;
  authenticity_notice: string | null;
  estimated_reusable_material_rate: number | null;
  estimated_reusable_area_cm2: number | null;
  long_strip_available: boolean | null;
  estimated_carbon_saving_kg: number | string | null;
  methodology_version: string | null;
  provider_name: string | null;
  provider_model: string | null;
  provider_request_id: string | null;
  provider_result: unknown;
  damages: unknown;
  warnings: unknown;
  created_at: string;
  completed_at: string | null;
};

type RecommendationRow = {
  product_id: string;
  eligible: boolean;
  score: number;
  estimated_reusable_material_rate: number;
  reason_codes: unknown;
};

type IdempotencyRow = {
  key: string;
  user_id: string;
  operation: string;
  resource_id: string | null;
  request_hash: string;
  response_status: number | null;
  response_body: unknown;
  expires_at: string;
};

type NormalizedProductInput = {
  category: SourceCategory;
  purchaseYear: number;
  useDuration: string;
  desiredUse: string;
  serialNumber: string | null;
  conditionNote: string | null;
};

/** Create and synchronously complete a v2 analysis. */
export async function createAnalysis(input: CreateAnalysisInput): Promise<Analysis> {
  const normalizedInput = normalizeProductInput(input);
  assertExternalAiConsent(input);
  const requestHash = analysisRequestHash(input, normalizedInput);
  const persistenceInput = {
    ...input,
    // The database key is internal and namespaced. The caller-visible
    // Idempotency-Key remains scoped to this user and operation rather than
    // occupying the table's global primary-key namespace.
    idempotencyKey: idempotencyStorageKey(input),
  };
  const admin = createAdminSupabaseClient();
  const reservation = await reserveIdempotencyKey(
    admin,
    persistenceInput,
    requestHash,
  );
  if (reservation) {
    return reservation;
  }

  let analysisId: string | null = null;
  let analysisCompleted = false;
  let externalAiConsentId: string | null = null;
  try {
    const assets = await readOrderedUploadedAssets(input, admin);
    externalAiConsentId = await recordExternalAiConsent(
      admin,
      persistenceInput,
      requestHash,
    );
    const imageUrls = await createSignedImageUrls(admin, assets);
    const providerOutput = await analyzeImages(input, imageUrls);
    const { result } = providerOutput;

    assertImageQualityContract(result, imageUrls.length);
    if (result.imageQuality.status === 'RECAPTURE_REQUIRED') {
      throw new ImageQualityInsufficientError(
        result.imageQuality.issues.map((issue) => ({
          assetId: input.imageAssetIds[issue.imageIndex],
          code: issue.code,
          guidanceKo: issue.guidanceKo,
        })),
      );
    }

    const products = await readActiveProductRules(admin);
    const derived = deriveAnalysis(providerOutput, products);
    analysisId = randomUUID();
    await attachIdempotencyResource(
      admin,
      persistenceInput,
      requestHash,
      analysisId,
    );
    const now = new Date().toISOString();
    const providerName = providerOutput.modeUsed === 'LIVE'
      ? 'OPENAI'
      : 'DEMO_DATA';

    const { error: analysisInsertError } = await admin.from('analyses').insert({
      id: analysisId,
      customer_id: input.customerId,
      status: 'RECEIVED',
      mode_used: providerOutput.modeUsed,
      category: normalizedInput.category,
      purchase_year: normalizedInput.purchaseYear,
      use_duration: normalizedInput.useDuration,
      desired_use: normalizedInput.desiredUse,
      serial_number: normalizedInput.serialNumber,
      condition_note: normalizedInput.conditionNote,
      source_category: result.sourceCategory,
      material_type: result.materialType,
      condition_grade: result.conditionGrade,
      damage_severity: result.overallDamageSeverity,
      summary: result.summaryKo,
      estimate_confidence_percent: derived.estimateMeta.confidencePercent,
      estimate_notice: derived.estimateMeta.notice,
      authenticity_precheck_status: derived.authenticityPrecheck.status,
      authenticity_estimate_percent:
        derived.authenticityPrecheck.estimatePercent,
      authenticity_notice: derived.authenticityPrecheck.notice,
      estimated_reusable_material_rate:
        derived.estimatedReusableMaterialRate,
      estimated_reusable_area_cm2: derived.estimatedReusableAreaCm2,
      long_strip_available: result.longStripAvailable,
      estimated_carbon_saving_kg:
        derived.esgPreview.estimatedCarbonSavingKgCo2e,
      methodology_version: 'DEMO_LCA_V2',
      provider_name: providerName,
      provider_model: providerOutput.model,
      provider_request_id: providerOutput.providerRequestId,
      provider_result: {
        confidence: result.confidence,
        imageQuality: { status: 'ACCEPTABLE', issues: [] },
      },
      damages: result.damages,
      warnings: providerOutput.warnings ?? [],
      created_at: now,
    });
    if (analysisInsertError) {
      throw databaseWriteError('analysis');
    }
    const { error: imagesInsertError } = await admin
      .from('analysis_images')
      .insert(
        input.imageAssetIds.map((mediaAssetId, displayOrder) => ({
          analysis_id: analysisId,
          media_asset_id: mediaAssetId,
          display_order: displayOrder,
        })),
      );
    if (imagesInsertError) {
      throw databaseWriteError('analysis images');
    }

    if (derived.recommendations.length > 0) {
      const { error: recommendationsInsertError } = await admin
        .from('analysis_recommendations')
        .insert(
          derived.recommendations.map((recommendation) => ({
            analysis_id: analysisId,
            product_id: recommendation.productId,
            eligible: recommendation.eligible,
            score: recommendation.score,
            estimated_reusable_material_rate:
              recommendation.estimatedReusableMaterialRate,
            reason_codes: recommendation.reasonCodes,
          })),
        );
      if (recommendationsInsertError) {
        throw databaseWriteError('analysis recommendations');
      }
    }

    const completedAt = new Date().toISOString();
    const { data: completedRow, error: completionError } = await admin
      .from('analyses')
      .update({ status: 'COMPLETED', completed_at: completedAt })
      .eq('id', analysisId)
      .eq('customer_id', input.customerId)
      .eq('status', 'RECEIVED')
      .select('id')
      .maybeSingle();
    if (completionError || completedRow?.id !== analysisId) {
      throw databaseWriteError('analysis completion');
    }
    await ensureExternalAiConsentLinked(
      admin,
      persistenceInput,
      requestHash,
      analysisId,
      externalAiConsentId,
    );
    analysisCompleted = true;

    const analysis: Analysis = {
      id: analysisId,
      status: 'COMPLETED',
      modeUsed: providerOutput.modeUsed,
      sourceProduct: {
        category: result.sourceCategory,
        materialType: result.materialType,
        confidence: result.confidence,
      },
      condition: {
        grade: result.conditionGrade,
        overallDamageSeverity: result.overallDamageSeverity,
        summary: result.summaryKo,
      },
      damages: result.damages,
      imageQuality: { status: 'ACCEPTABLE', issues: [] },
      estimateMeta: derived.estimateMeta,
      authenticityPrecheck: derived.authenticityPrecheck,
      estimatedReusableMaterialRate: derived.estimatedReusableMaterialRate,
      estimatedReusableAreaCm2: derived.estimatedReusableAreaCm2,
      longStripAvailable: result.longStripAvailable,
      recommendations: derived.recommendations,
      esgPreview: derived.esgPreview,
      provider: {
        name: providerName,
        model: providerOutput.model,
        requestId: providerOutput.providerRequestId,
      },
      warnings: providerOutput.warnings ?? [],
      createdAt: now,
      completedAt,
    };

    try {
      await storeIdempotentSuccess(admin, persistenceInput, analysis);
    } catch {
      // The domain result is already committed. Returning 201 avoids telling
      // the caller to retry a mutation that succeeded; a retry can recover the
      // completed row through the reservation's resource_id.
      console.error('[Analysis] Failed to cache completed idempotency response');
    }
    return analysis;
  } catch (error) {
    if (analysisId && !analysisCompleted) {
      const removedIncompleteAnalysis = await cleanupIncompleteAnalysis(
        admin,
        analysisId,
        input.customerId,
      );
      if (!removedIncompleteAnalysis) {
        const recovered = await recoverCompletedAnalysis(
          admin,
          analysisId,
          input.customerId,
        );
        if (recovered) {
          await ensureExternalAiConsentLinked(
            admin,
            persistenceInput,
            requestHash,
            recovered.id,
          );
          try {
            await storeIdempotentSuccess(admin, persistenceInput, recovered);
          } catch {
            console.error(
              '[Analysis] Failed to cache recovered idempotency response',
            );
          }
          return recovered;
        }
      }
    }
    await storeIdempotentFailure(admin, persistenceInput, error);
    throw error;
  }
}

function assertExternalAiConsent(input: CreateAnalysisInput): void {
  const mode = (process.env.AI_MODE ?? 'DEMO_FIXTURE').trim().toUpperCase();
  if (mode !== 'LIVE') {
    return;
  }

  assertExternalAiReady();
  const expectedVersion =
    process.env.EXTERNAL_AI_PRIVACY_NOTICE_VERSION?.trim();
  if (
    input.externalAiProcessingConsentAccepted !== true ||
    !expectedVersion ||
    input.externalAiPrivacyNoticeVersion?.trim() !== expectedVersion
  ) {
    throw new ForbiddenError(
      'External AI image processing consent is required for the active privacy notice',
    );
  }
}

async function recordExternalAiConsent(
  admin: SupabaseClient,
  input: CreateAnalysisInput,
  requestHash: string,
): Promise<string | null> {
  const mode = (process.env.AI_MODE ?? 'DEMO_FIXTURE').trim().toUpperCase();
  if (mode !== 'LIVE') {
    return null;
  }

  const privacyNoticeVersion =
    input.externalAiPrivacyNoticeVersion?.trim();
  if (!privacyNoticeVersion) {
    throw new ForbiddenError(
      'External AI image processing consent is required for the active privacy notice',
    );
  }

  const consentReceiptHash = externalAiConsentReceiptHash(input, requestHash);
  const consentId = randomUUID();
  const { error } = await admin.from('analysis_external_ai_consents').insert({
    id: consentId,
    customer_id: input.customerId,
    request_hash: consentReceiptHash,
    privacy_notice_version: privacyNoticeVersion,
    accepted_at: new Date().toISOString(),
  });
  if (!error) {
    return consentId;
  }
  if (error.code !== '23505') {
    throw databaseWriteError('external AI consent');
  }

  const { data: existing, error: readError } = await admin
    .from('analysis_external_ai_consents')
    .select('id,privacy_notice_version,analysis_id')
    .eq('customer_id', input.customerId)
    .eq('request_hash', consentReceiptHash)
    .maybeSingle();
  if (
    readError ||
    !existing ||
    existing.privacy_notice_version !== privacyNoticeVersion
  ) {
    throw databaseWriteError('external AI consent recovery');
  }
  if (existing.analysis_id !== null) {
    throw new ConflictError(
      'EXTERNAL_AI_CONSENT_ALREADY_USED',
      'This external AI consent receipt already belongs to an analysis',
    );
  }
  return existing.id;
}

async function ensureExternalAiConsentLinked(
  admin: SupabaseClient,
  input: CreateAnalysisInput,
  requestHash: string,
  analysisId: string,
  knownConsentId?: string | null,
): Promise<void> {
  const mode = (process.env.AI_MODE ?? 'DEMO_FIXTURE').trim().toUpperCase();
  if (mode !== 'LIVE') {
    return;
  }

  let query = admin
    .from('analysis_external_ai_consents')
    .select('id,analysis_id')
    .eq('customer_id', input.customerId);
  query = knownConsentId
    ? query.eq('id', knownConsentId)
    : query.eq(
        'request_hash',
        externalAiConsentReceiptHash(input, requestHash),
      );
  const { data: consent, error: readError } = await query.maybeSingle();
  if (readError || !consent) {
    throw databaseWriteError('external AI consent recovery');
  }
  if (consent.analysis_id === analysisId) {
    return;
  }
  if (consent.analysis_id !== null) {
    throw new ConflictError(
      'EXTERNAL_AI_CONSENT_ALREADY_USED',
      'This external AI consent receipt already belongs to an analysis',
    );
  }

  const { data: linked, error: linkError } = await admin
    .from('analysis_external_ai_consents')
    .update({ analysis_id: analysisId })
    .eq('id', consent.id)
    .eq('customer_id', input.customerId)
    .is('analysis_id', null)
    .select('id')
    .maybeSingle();
  if (linkError || linked?.id !== consent.id) {
    throw databaseWriteError('external AI consent link');
  }
}

function externalAiConsentReceiptHash(
  input: CreateAnalysisInput,
  requestHash: string,
): string {
  return createHash('sha256')
    .update(
      `${input.customerId}:${ANALYSIS_OPERATION}:${input.idempotencyKey}:${requestHash}`,
    )
    .digest('hex');
}

/** List the authenticated customer's analyses through RLS. */
export async function listMyAnalyses(
  viewer: AnalysisViewer,
  page: number,
  size: number,
): Promise<PagedAnalyses> {
  if (!viewer.accessToken) {
    throw new ForbiddenError('A customer access token is required');
  }
  const client = createUserSupabaseClient(viewer.accessToken);
  const { data, error, count } = await client
    .from('analyses')
    .select(
      'id,source_category,condition_grade,estimated_reusable_material_rate,estimate_confidence_percent,estimate_notice,mode_used,created_at',
      { count: 'exact' },
    )
    .eq('customer_id', viewer.id)
    .eq('status', 'COMPLETED')
    .order('created_at', { ascending: false })
    .range(page * size, (page + 1) * size - 1);

  if (error) {
    throw new ServiceUnavailableError('Analysis storage is unavailable');
  }

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    source_category: string;
    condition_grade: string;
    estimated_reusable_material_rate: number;
    estimate_confidence_percent: number;
    estimate_notice: string;
    mode_used: string;
    created_at: string;
  }>;
  const totalElements = count ?? 0;

  return {
    items: rows.map((row) => {
      const modeUsed = AnalysisModeUsedSchema.parse(row.mode_used);
      return {
        id: row.id,
        sourceCategory: SourceCategorySchema.parse(row.source_category),
        conditionGrade: ConditionGradeSchema.parse(row.condition_grade),
        estimatedReusableMaterialRate: requireInteger(
          row.estimated_reusable_material_rate,
          'estimated_reusable_material_rate',
        ),
        estimateMeta: {
          mode: modeUsed,
          confidencePercent: requireInteger(
            row.estimate_confidence_percent,
            'estimate_confidence_percent',
          ),
          notice: requireString(row.estimate_notice, 'estimate_notice'),
        },
        modeUsed,
        createdAt: requireString(row.created_at, 'created_at'),
      };
    }),
    page,
    size,
    totalElements,
    totalPages: Math.ceil(totalElements / size),
  };
}

/** Read and serialize a completed analysis after RLS and owner checks. */
export async function getAnalysisById(
  analysisId: string,
  viewer: AnalysisViewer,
): Promise<Analysis> {
  const row = await readAuthorizedAnalysisRow(analysisId, viewer);
  const admin = createAdminSupabaseClient();
  const recommendations = await readStoredRecommendations(admin, analysisId);
  return serializeAnalysis(row, recommendations);
}

async function readOrderedUploadedAssets(
  input: CreateAnalysisInput,
  admin: SupabaseClient,
): Promise<MediaAssetRow[]> {
  if (input.imageAssetIds.length !== 6 || new Set(input.imageAssetIds).size !== 6) {
    throw new ValidationError('Exactly six unique imageAssetIds are required');
  }
  if (!input.accessToken) {
    throw new ForbiddenError('A customer access token is required');
  }

  const userClient = createUserSupabaseClient(input.accessToken);
  const { data, error } = await userClient
    .from('media_assets')
    .select('id,owner_id,bucket,path,upload_status')
    .in('id', input.imageAssetIds);
  if (error) {
    throw new ServiceUnavailableError('Upload metadata is unavailable');
  }

  const rows = (data ?? []) as unknown as MediaAssetRow[];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = input.imageAssetIds.map((assetId) => byId.get(assetId));
  if (ordered.some((asset) => !asset)) {
    throw new ForbiddenError('One or more image assets are not owned by this customer');
  }

  const ownedAssets = ordered.map((asset) => {
    if (!asset || asset.owner_id !== input.customerId) {
      throw new ForbiddenError('One or more image assets are not owned by this customer');
    }
    if (asset.bucket !== 'source-products') {
      throw new ValidationError('Image asset is stored in an unsupported bucket');
    }
    return asset;
  });

  // Signed uploads do not have a completion callback in the current contract.
  // Reconcile PENDING metadata against private Storage before the DB trigger
  // evaluates the exact-six UPLOADED invariant.
  await Promise.all(
    ownedAssets.map(async (asset) => {
      const { data: exists, error: storageError } = await admin.storage
        .from(asset.bucket)
        .exists(asset.path);
      if (storageError) {
        throw new ServiceUnavailableError('Uploaded image could not be verified');
      }
      if (!exists) {
        throw new ValidationError('All six image assets must be uploaded before analysis', {
          assetId: asset.id,
          uploadStatus: asset.upload_status,
        });
      }
    }),
  );

  const assetIds = ownedAssets.map((asset) => asset.id);
  const { data: promoted, error: promoteError } = await admin
    .from('media_assets')
    .update({ upload_status: 'UPLOADED' })
    .eq('owner_id', input.customerId)
    .in('id', assetIds)
    .select('id');
  if (promoteError || (promoted?.length ?? 0) !== assetIds.length) {
    throw new ServiceUnavailableError('Upload status could not be reconciled');
  }

  return ownedAssets.map((asset) => ({
    ...asset,
    upload_status: 'UPLOADED',
  }));
}

async function createSignedImageUrls(
  admin: SupabaseClient,
  assets: MediaAssetRow[],
): Promise<string[]> {
  return Promise.all(
    assets.map(async (asset) => {
      const { data, error } = await admin.storage
        .from(asset.bucket)
        .createSignedUrl(asset.path, 3600);
      if (error || !data?.signedUrl) {
        throw new ServiceUnavailableError('Uploaded image could not be read');
      }
      return data.signedUrl;
    }),
  );
}

async function analyzeImages(input: CreateAnalysisInput, imageUrls: string[]) {
  try {
    return await createVisionProvider().analyze({
      imageUrls,
      demoScenarioKey: input.demoScenarioKey,
    });
  } catch (error) {
    if (error instanceof VisionImageQualityError) {
      throw new ImageQualityInsufficientError(
        error.issues.map((issue) => ({
          assetId: input.imageAssetIds[issue.imageIndex],
          code: issue.code,
          guidanceKo: issue.guidanceKo,
        })),
      );
    }
    if (isAppError(error)) {
      throw error;
    }
    // The original error is discarded below so it never reaches the client,
    // but that also erased it from server logs. Log only the safe,
    // non-sensitive shape (no image URLs, tokens, or provider payloads) so a
    // provider failure can actually be diagnosed from Vercel/server logs.
    console.error('[analyzeImages] vision provider threw an unexpected error', {
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
    });
    throw new UpstreamError('Analysis provider failed');
  }
}

async function readActiveProductRules(
  admin: SupabaseClient,
): Promise<ProductRuleRow[]> {
  const { data, error } = await admin
    .from('products')
    .select('id,code,required_area_cm2')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) {
    throw new ServiceUnavailableError('Product catalog is unavailable');
  }
  return (data ?? []) as unknown as ProductRuleRow[];
}

function deriveAnalysis(
  providerOutput: Awaited<ReturnType<ReturnType<typeof createVisionProvider>['analyze']>>,
  products: ProductRuleRow[],
) {
  const { result, fixtureEstimate, modeUsed } = providerOutput;
  const calculated = calculateReusableMaterial(
    result.sourceCategory,
    result.conditionGrade,
    result.overallDamageSeverity,
  );
  const estimatedReusableMaterialRate =
    fixtureEstimate?.estimatedReusableMaterialRate ??
    calculated.reusableMaterialRate;
  const estimatedReusableAreaCm2 =
    fixtureEstimate?.estimatedReusableAreaCm2 ??
    calculated.estimatedReusableAreaCm2;
  const fixtureByProduct = new Map(
    (fixtureEstimate?.recommendations ?? []).map((recommendation) => [
      recommendation.productId,
      recommendation,
    ]),
  );

  const recommendationProducts =
    result.authenticityPrecheck.status === 'INELIGIBLE' ? [] : products;
  const recommendations: AnalysisRecommendation[] = recommendationProducts.map((product) => {
    const productCode = ProductCodeSchema.parse(product.code);
    const fixture = fixtureByProduct.get(product.id);
    if (fixture) {
      return {
        productId: product.id,
        productCode,
        eligible: fixture.eligible,
        score: fixture.score,
        estimatedReusableMaterialRate:
          fixture.estimatedReusableMaterialRate,
        reasonCodes: fixture.reasonCodes.map((code) =>
          RecommendationReasonCodeSchema.parse(code),
        ),
      };
    }

    const recommendation = calculateRecommendationScore(
      estimatedReusableAreaCm2,
      product.required_area_cm2,
      result.conditionGrade,
      product.code,
    );
    return {
      productId: product.id,
      productCode,
      ...recommendation,
      estimatedReusableMaterialRate,
    };
  });

  return {
    estimateMeta: fixtureEstimate?.estimateMeta ?? {
      mode: modeUsed,
      confidencePercent: Math.round(result.confidence * 100),
      notice: PROVIDER_NOTICE[modeUsed],
    },
    authenticityPrecheck:
      fixtureEstimate?.authenticityPrecheck ?? result.authenticityPrecheck,
    estimatedReusableMaterialRate,
    estimatedReusableAreaCm2,
    recommendations,
    esgPreview: fixtureEstimate?.esgPreview ?? {
      methodologyVersion: 'DEMO_LCA_V2' as const,
      estimatedCarbonSavingKgCo2e: calculateCarbonSaving(
        estimatedReusableAreaCm2,
      ),
      disclaimer: '해커톤용 추정치이며 공인 ESG 수치가 아닙니다.',
    },
  };
}

async function readAuthorizedAnalysisRow(
  analysisId: string,
  viewer: AnalysisViewer,
): Promise<AnalysisRow> {
  if (!viewer.accessToken) {
    throw new ForbiddenError('An authenticated access token is required');
  }
  const userClient = createUserSupabaseClient(viewer.accessToken);
  const { data, error } = await userClient
    .from('analyses')
    .select('*')
    .eq('id', analysisId)
    .maybeSingle();
  if (error) {
    throw new ServiceUnavailableError('Analysis storage is unavailable');
  }
  if (data) {
    const row = data as unknown as AnalysisRow;
    if (viewer.role === 'CUSTOMER' && row.customer_id !== viewer.id) {
      throw new ForbiddenError('You do not have permission to access this analysis');
    }
    return row;
  }

  // RLS intentionally hides other customers' rows. A server-side existence
  // check distinguishes the documented 403 from a genuine 404 without
  // exposing any resource data.
  const admin = createAdminSupabaseClient();
  const { data: existence, error: existenceError } = await admin
    .from('analyses')
    .select('customer_id')
    .eq('id', analysisId)
    .maybeSingle();
  if (existenceError) {
    throw new ServiceUnavailableError('Analysis storage is unavailable');
  }
  if (existence) {
    throw new ForbiddenError('You do not have permission to access this analysis');
  }
  throw new NotFoundError('Analysis');
}

async function readStoredRecommendations(
  admin: SupabaseClient,
  analysisId: string,
): Promise<AnalysisRecommendation[]> {
  const { data, error } = await admin
    .from('analysis_recommendations')
    .select(
      'product_id,eligible,score,estimated_reusable_material_rate,reason_codes',
    )
    .eq('analysis_id', analysisId)
    .order('score', { ascending: false });
  if (error) {
    throw new ServiceUnavailableError('Analysis recommendations are unavailable');
  }
  const rows = (data ?? []) as unknown as RecommendationRow[];
  if (rows.length === 0) {
    return [];
  }

  const { data: products, error: productsError } = await admin
    .from('products')
    .select('id,code')
    .in('id', rows.map((row) => row.product_id));
  if (productsError) {
    throw new ServiceUnavailableError('Product catalog is unavailable');
  }
  const productCodes = new Map(
    ((products ?? []) as unknown as Array<{ id: string; code: string }>).map(
      (product) => [product.id, ProductCodeSchema.parse(product.code)],
    ),
  );

  return rows.map((row) => {
    const productCode = productCodes.get(row.product_id);
    if (!productCode) {
      throw new UpstreamError('Analysis recommendation product is missing');
    }
    return {
      productId: row.product_id,
      productCode,
      eligible: row.eligible,
      score: requireInteger(row.score, 'recommendation.score'),
      estimatedReusableMaterialRate: requireInteger(
        row.estimated_reusable_material_rate,
        'recommendation.estimated_reusable_material_rate',
      ),
      reasonCodes: requireStringArray(row.reason_codes).map((code) =>
        RecommendationReasonCodeSchema.parse(code),
      ),
    };
  });
}

function serializeAnalysis(
  row: AnalysisRow,
  recommendations: AnalysisRecommendation[],
): Analysis {
  if (row.status !== 'COMPLETED') {
    throw new UpstreamError('Analysis is not complete');
  }
  const modeUsed = AnalysisModeUsedSchema.parse(row.mode_used);
  const providerResult = isRecord(row.provider_result)
    ? row.provider_result
    : {};
  const confidence = requireNumber(
    providerResult.confidence,
    'provider_result.confidence',
  );
  const authenticityStatus = row.authenticity_precheck_status;
  if (
    authenticityStatus !== 'ORDER_ELIGIBLE' &&
    authenticityStatus !== 'INELIGIBLE'
  ) {
    throw new UpstreamError('Stored analysis authenticity status is invalid');
  }
  if (row.methodology_version !== 'DEMO_LCA_V2') {
    throw new UpstreamError('Stored analysis methodology is invalid');
  }
  if (row.provider_name !== 'OPENAI' && row.provider_name !== 'DEMO_DATA') {
    throw new UpstreamError('Stored analysis provider is invalid');
  }

  return {
    id: row.id,
    status: 'COMPLETED',
    modeUsed,
    sourceProduct: {
      category: SourceCategorySchema.parse(row.source_category),
      materialType: MaterialTypeSchema.parse(row.material_type),
      confidence,
    },
    condition: {
      grade: ConditionGradeSchema.parse(row.condition_grade),
      overallDamageSeverity: requireInteger(
        row.damage_severity,
        'damage_severity',
      ),
      summary: requireString(row.summary, 'summary'),
    },
    damages: requireDamages(row.damages),
    imageQuality: { status: 'ACCEPTABLE', issues: [] },
    estimateMeta: {
      mode: modeUsed,
      confidencePercent: requireInteger(
        row.estimate_confidence_percent,
        'estimate_confidence_percent',
      ),
      notice: requireString(row.estimate_notice, 'estimate_notice'),
    },
    authenticityPrecheck: {
      status: authenticityStatus,
      estimatePercent: requireInteger(
        row.authenticity_estimate_percent,
        'authenticity_estimate_percent',
      ),
      notice: requireString(row.authenticity_notice, 'authenticity_notice'),
    },
    estimatedReusableMaterialRate: requireInteger(
      row.estimated_reusable_material_rate,
      'estimated_reusable_material_rate',
    ),
    estimatedReusableAreaCm2: requireInteger(
      row.estimated_reusable_area_cm2,
      'estimated_reusable_area_cm2',
    ),
    longStripAvailable: requireBoolean(
      row.long_strip_available,
      'long_strip_available',
    ),
    recommendations,
    esgPreview: {
      methodologyVersion: 'DEMO_LCA_V2',
      estimatedCarbonSavingKgCo2e: requireNumber(
        row.estimated_carbon_saving_kg,
        'estimated_carbon_saving_kg',
      ),
      disclaimer: '해커톤용 추정치이며 공인 ESG 수치가 아닙니다.',
    },
    provider: {
      name: row.provider_name,
      model: requireString(row.provider_model, 'provider_model'),
      requestId: row.provider_request_id,
    },
    warnings: requireWarnings(row.warnings),
    createdAt: requireString(row.created_at, 'created_at'),
    completedAt: requireString(row.completed_at, 'completed_at'),
  };
}

function normalizeProductInput(input: CreateAnalysisInput): NormalizedProductInput {
  const category = input.category ?? input.sourceCategoryHint;
  if (!category) {
    throw new ValidationError('category is required');
  }
  if (!Number.isInteger(input.purchaseYear) || input.purchaseYear! < 1976 || input.purchaseYear! > 2100) {
    throw new ValidationError('purchaseYear must be between 1976 and 2100');
  }
  const useDuration = input.useDuration?.trim();
  const desiredUse = input.desiredUse?.trim();
  if (!useDuration || !desiredUse) {
    throw new ValidationError('useDuration and desiredUse are required');
  }
  return {
    category,
    purchaseYear: input.purchaseYear!,
    useDuration,
    desiredUse,
    serialNumber: input.serialNumber?.trim() || null,
    conditionNote: input.conditionNote?.trim() || null,
  };
}

function analysisRequestHash(
  input: CreateAnalysisInput,
  normalized: NormalizedProductInput,
): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        imageAssetIds: input.imageAssetIds,
        ...normalized,
        locale: input.locale,
        demoScenarioKey: input.demoScenarioKey ?? null,
        externalAiProcessingConsentAccepted:
          input.externalAiProcessingConsentAccepted ?? null,
        externalAiPrivacyNoticeVersion:
          input.externalAiPrivacyNoticeVersion?.trim() ?? null,
      }),
    )
    .digest('hex');
}

function idempotencyStorageKey(input: CreateAnalysisInput): string {
  return createHash('sha256')
    .update(`${input.customerId}:${ANALYSIS_OPERATION}:${input.idempotencyKey}`)
    .digest('hex');
}

async function reserveIdempotencyKey(
  admin: SupabaseClient,
  input: CreateAnalysisInput,
  requestHash: string,
  allowExpiredReclaim = true,
): Promise<Analysis | null> {
  const { error } = await admin.from('idempotency_keys').insert({
    key: input.idempotencyKey,
    user_id: input.customerId,
    operation: ANALYSIS_OPERATION,
    request_hash: requestHash,
  });
  if (!error) {
    return null;
  }
  if (error.code !== '23505') {
    throw new ServiceUnavailableError('Idempotency storage is unavailable');
  }

  const { data: existing, error: readError } = await admin
    .from('idempotency_keys')
    .select(
      'key,user_id,operation,resource_id,request_hash,response_status,response_body,expires_at',
    )
    .eq('key', input.idempotencyKey)
    .maybeSingle();
  if (readError || !existing) {
    throw new ServiceUnavailableError('Idempotency storage is unavailable');
  }
  const row = existing as unknown as IdempotencyRow;
  if (
    row.user_id !== input.customerId ||
    row.operation !== ANALYSIS_OPERATION ||
    row.request_hash !== requestHash
  ) {
    throw new ConflictError(
      'IDEMPOTENCY_KEY_REUSED',
      'The same Idempotency-Key cannot be used for a different request',
    );
  }
  if (row.response_status === 201 && isAnalysisResponse(row.response_body)) {
    return row.response_body;
  }
  if (row.response_status === null && row.resource_id) {
    const recovered = await recoverCompletedAnalysis(
      admin,
      row.resource_id,
      input.customerId,
    );
    if (recovered) {
      await ensureExternalAiConsentLinked(
        admin,
        input,
        requestHash,
        recovered.id,
      );
      try {
        await storeIdempotentSuccess(admin, input, recovered);
      } catch {
        console.error('[Analysis] Failed to restore idempotency response cache');
      }
      return recovered;
    }
  }
  if (row.response_status !== null) {
    throw new ConflictError(
      'ANALYSIS_REQUEST_PREVIOUSLY_FAILED',
      'The previous analysis request failed; use a new Idempotency-Key after correcting the input',
    );
  }
  if (
    allowExpiredReclaim &&
    Number.isFinite(Date.parse(row.expires_at)) &&
    Date.parse(row.expires_at) <= Date.now()
  ) {
    if (row.resource_id) {
      const removedIncompleteAnalysis = await cleanupIncompleteAnalysis(
        admin,
        row.resource_id,
        input.customerId,
      );
      if (!removedIncompleteAnalysis) {
        const recovered = await recoverCompletedAnalysis(
          admin,
          row.resource_id,
          input.customerId,
        );
        if (recovered) {
          await ensureExternalAiConsentLinked(
            admin,
            input,
            requestHash,
            recovered.id,
          );
          await storeIdempotentSuccess(admin, input, recovered);
          return recovered;
        }
        throw new ConflictError(
          'ANALYSIS_REQUEST_IN_PROGRESS',
          'An analysis request with this Idempotency-Key is still being finalized',
        );
      }
    }
    const { data: deleted, error: deleteError } = await admin
      .from('idempotency_keys')
      .delete()
      .eq('key', input.idempotencyKey)
      .eq('request_hash', requestHash)
      .is('response_status', null)
      .lt('expires_at', new Date().toISOString())
      .select('key');
    if (deleteError) {
      throw new ServiceUnavailableError('Idempotency storage is unavailable');
    }
    if (Array.isArray(deleted) && deleted.length === 1) {
      return reserveIdempotencyKey(admin, input, requestHash, false);
    }
  }
  throw new ConflictError(
    'ANALYSIS_REQUEST_IN_PROGRESS',
    'An analysis request with this Idempotency-Key is already in progress',
  );
}

async function attachIdempotencyResource(
  admin: SupabaseClient,
  input: CreateAnalysisInput,
  requestHash: string,
  analysisId: string,
): Promise<void> {
  const { data, error } = await admin
    .from('idempotency_keys')
    .update({ resource_id: analysisId })
    .eq('key', input.idempotencyKey)
    .eq('user_id', input.customerId)
    .eq('operation', ANALYSIS_OPERATION)
    .eq('request_hash', requestHash)
    .is('response_status', null)
    .select('key')
    .maybeSingle();
  if (error || data?.key !== input.idempotencyKey) {
    throw new ServiceUnavailableError('Idempotency resource could not be reserved');
  }
}

async function recoverCompletedAnalysis(
  admin: SupabaseClient,
  analysisId: string,
  customerId: string,
): Promise<Analysis | null> {
  const { data, error } = await admin
    .from('analyses')
    .select('*')
    .eq('id', analysisId)
    .eq('customer_id', customerId)
    .eq('status', 'COMPLETED')
    .maybeSingle();
  if (error) {
    throw new ServiceUnavailableError('Analysis recovery is unavailable');
  }
  if (!data) {
    return null;
  }

  const recommendations = await readStoredRecommendations(admin, analysisId);
  return serializeAnalysis(data as unknown as AnalysisRow, recommendations);
}

async function storeIdempotentSuccess(
  admin: SupabaseClient,
  input: CreateAnalysisInput,
  analysis: Analysis,
): Promise<void> {
  const { data, error } = await admin
    .from('idempotency_keys')
    .update({
      resource_id: analysis.id,
      response_status: 201,
      response_body: analysis,
    })
    .eq('key', input.idempotencyKey)
    .eq('user_id', input.customerId)
    .eq('operation', ANALYSIS_OPERATION)
    .is('response_status', null)
    .select('key')
    .maybeSingle();
  if (error || data?.key !== input.idempotencyKey) {
    throw new ServiceUnavailableError('Idempotency result could not be stored');
  }
}

async function storeIdempotentFailure(
  admin: SupabaseClient,
  input: CreateAnalysisInput,
  error: unknown,
): Promise<void> {
  const appError = isAppError(error) ? error : null;
  const { error: updateError } = await admin
    .from('idempotency_keys')
    .update({
      response_status: appError?.statusCode ?? 500,
      response_body: {
        failed: true,
        errorCode: appError?.code ?? 'INTERNAL_ERROR',
      },
    })
    .eq('key', input.idempotencyKey)
    .eq('user_id', input.customerId)
    .eq('operation', ANALYSIS_OPERATION)
    .is('response_status', null);
  if (updateError) {
    console.error('[Analysis] Failed to persist idempotency failure state');
  }
}

async function cleanupIncompleteAnalysis(
  admin: SupabaseClient,
  analysisId: string,
  customerId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from('analyses')
    .delete()
    .eq('id', analysisId)
    .eq('customer_id', customerId)
    .neq('status', 'COMPLETED')
    .select('id');
  if (error) {
    console.error('[Analysis] Failed to clean up incomplete analysis row');
    return false;
  }
  return Array.isArray(data) && data.length === 1;
}

function databaseWriteError(resource: string): AppError {
  return new ServiceUnavailableError(`${resource} could not be stored`);
}

function isAppError(error: unknown): error is AppError {
  return (
    error instanceof Error &&
    'statusCode' in error &&
    'code' in error &&
    typeof error.statusCode === 'number' &&
    typeof error.code === 'string'
  );
}

function isAnalysisResponse(value: unknown): value is Analysis {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.status === 'COMPLETED' &&
    typeof value.createdAt === 'string'
  );
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new UpstreamError(`Stored analysis field is invalid: ${field}`);
  }
  return value;
}

function requireNumber(value: unknown, field: string): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) {
    throw new UpstreamError(`Stored analysis field is invalid: ${field}`);
  }
  return parsed;
}

function requireInteger(value: unknown, field: string): number {
  const parsed = requireNumber(value, field);
  if (!Number.isInteger(parsed)) {
    throw new UpstreamError(`Stored analysis field is invalid: ${field}`);
  }
  return parsed;
}

function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new UpstreamError(`Stored analysis field is invalid: ${field}`);
  }
  return value;
}

function requireStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new UpstreamError('Stored string array is invalid');
  }
  return value;
}

function requireDamages(value: unknown): Analysis['damages'] {
  if (!Array.isArray(value)) {
    throw new UpstreamError('Stored analysis damages are invalid');
  }
  return value.map((damage) => {
    if (!isRecord(damage)) {
      throw new UpstreamError('Stored analysis damage is invalid');
    }
    return {
      type: requireString(damage.type, 'damage.type'),
      location: requireString(damage.location, 'damage.location'),
      severity: requireInteger(damage.severity, 'damage.severity'),
      confidence: requireNumber(damage.confidence, 'damage.confidence'),
    };
  });
}

function requireWarnings(value: unknown): Analysis['warnings'] {
  if (!Array.isArray(value)) {
    throw new UpstreamError('Stored analysis warnings are invalid');
  }
  return value.map((warning) => {
    if (!isRecord(warning)) {
      throw new UpstreamError('Stored analysis warning is invalid');
    }
    return {
      code: requireString(warning.code, 'warning.code'),
      message: requireString(warning.message, 'warning.message'),
    };
  });
}
