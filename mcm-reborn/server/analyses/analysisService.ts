import { supabaseAdmin } from '@/lib/supabase/server';
import { getSignedReadUrl } from '@/server/storage/uploadService';
import { createVisionProvider } from '@/server/openai/visionProviderFactory';
import {
  calculateReusableMaterial,
  calculateRecommendationScore,
  calculateCarbonSaving,
} from '@/server/recommendation/calculateRecommendations';
import {
  SourceCategory,
  ConditionGrade,
  AuthenticitySignal,
  AnalysisModeUsed,
} from '@/contracts/analysis';
import { ImageQualityInsufficientError, AuthenticityReviewRequiredError } from '@/contracts/errors';
import { randomUUID } from 'crypto';

export interface CreateAnalysisInput {
  customerId: string;
  imageAssetIds: string[];
  sourceCategoryHint?: SourceCategory | null;
  locale: string;
  demoScenarioKey?: string | null;
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
  imageQuality: {
    status: 'ACCEPTABLE';
    issues: [];
  };
  authenticitySignal: AuthenticitySignal;
  reusableMaterialRate: number;
  estimatedReusableAreaCm2: number;
  longStripAvailable: boolean;
  recommendations: Array<{
    productId: string;
    productCode: string;
    eligible: boolean;
    score: number;
    reasonCodes: string[];
  }>;
  esgPreview: {
    methodologyVersion: 'DEMO_LCA_V1';
    estimatedCarbonSavingKgCo2e: number;
    disclaimer: string;
  };
  provider: {
    name: string;
    model: string;
    requestId: string | null;
  };
  warnings: Array<{ code: string; message: string }>;
  createdAt: string;
  completedAt: string;
}

/**
 * Create a new analysis
 */
export async function createAnalysis(input: CreateAnalysisInput): Promise<Analysis> {
  const { customerId, imageAssetIds, demoScenarioKey } = input;

  // Verify asset ownership
  const { data: assets, error: assetsError } = await supabaseAdmin
    .from('media_assets')
    .select('id, path')
    .in('id', imageAssetIds)
    .eq('owner_id', customerId);

  if (assetsError || !assets || assets.length !== imageAssetIds.length) {
    throw new Error('One or more image assets not found or unauthorized');
  }

  // Get signed URLs for analysis
  const imageUrls = await Promise.all(
    assets.map((asset) => getSignedReadUrl(asset.path, 3600))
  );

  // Perform vision analysis
  const provider = createVisionProvider();
  let visionResult;

  try {
    visionResult = await provider.analyze({ imageUrls, demoScenarioKey });
  } catch (error) {
    // Map imageIndex to assetId for quality errors
    if (error instanceof ImageQualityInsufficientError) {
      const mappedIssues = error.imageQualityIssues.map((issue, idx) => ({
        assetId: imageAssetIds[idx] ?? imageAssetIds[0],
        code: issue.code,
        guidanceKo: issue.guidanceKo,
      }));
      throw new ImageQualityInsufficientError(mappedIssues);
    }
    throw error;
  }

  const { result, model, providerRequestId, modeUsed } = visionResult;
  const warnings = (visionResult as { warnings?: Array<{ code: string; message: string }> }).warnings;

  // Calculate reusable material
  const { reusableMaterialRate, estimatedReusableAreaCm2 } = calculateReusableMaterial(
    result.sourceCategory,
    result.conditionGrade,
    result.overallDamageSeverity
  );

  // Get active products
  const { data: products, error: productsError } = await supabaseAdmin
    .from('products')
    .select('id, code, required_area_cm2')
    .eq('active', true);

  if (productsError || !products) {
    throw new Error('Failed to fetch products');
  }

  // Calculate recommendations
  const recommendations = products.map((product) => {
    const rec = calculateRecommendationScore(
      estimatedReusableAreaCm2,
      product.required_area_cm2,
      result.conditionGrade,
      product.code
    );
    return {
      productId: product.id,
      productCode: product.code,
      ...rec,
    };
  });

  // Calculate ESG preview
  const estimatedCarbonSavingKgCo2e = calculateCarbonSaving(estimatedReusableAreaCm2);

  const analysisId = randomUUID();
  const now = new Date().toISOString();

  // Save analysis to database
  const { error: insertError } = await supabaseAdmin.from('analyses').insert({
    id: analysisId,
    customer_id: customerId,
    status: 'COMPLETED',
    mode_used: modeUsed,
    source_category: result.sourceCategory,
    material_type: result.materialType,
    condition_grade: result.conditionGrade,
    damage_severity: result.overallDamageSeverity,
    authenticity_signal: result.authenticitySignal,
    reusable_rate: reusableMaterialRate,
    reusable_area_cm2: estimatedReusableAreaCm2,
    long_strip_available: result.longStripAvailable,
    provider_result: {
      confidence: result.confidence,
      summary: result.summaryKo,
      damages: result.damages,
      provider: {
        name: modeUsed === 'LIVE' ? 'OPENAI' : 'FIXTURE',
        model,
        requestId: providerRequestId,
      },
    },
    created_at: now,
    completed_at: now,
  });

  if (insertError) {
    throw new Error(`Failed to save analysis: ${insertError.message}`);
  }

  // If REVIEW_REQUIRED, create manual review case and throw error
  if (result.authenticitySignal === 'REVIEW_REQUIRED') {
    const reviewCaseId = randomUUID();
    await supabaseAdmin.from('manual_review_cases').insert({
      id: reviewCaseId,
      analysis_id: analysisId,
      status: 'PENDING',
      reason_code: 'AUTHENTICITY_SIGNAL',
      created_at: now,
    });

    throw new AuthenticityReviewRequiredError(analysisId, reviewCaseId);
  }

  // Return full analysis
  return {
    id: analysisId,
    status: 'COMPLETED',
    modeUsed: modeUsed as AnalysisModeUsed,
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
    imageQuality: {
      status: 'ACCEPTABLE',
      issues: [],
    },
    authenticitySignal: result.authenticitySignal,
    reusableMaterialRate,
    estimatedReusableAreaCm2,
    longStripAvailable: result.longStripAvailable,
    recommendations,
    esgPreview: {
      methodologyVersion: 'DEMO_LCA_V1',
      estimatedCarbonSavingKgCo2e,
      disclaimer: '해커톤용 추정치이며 공인 ESG 수치가 아닙니다.',
    },
    provider: {
      name: modeUsed === 'LIVE' ? 'OPENAI' : 'FIXTURE',
      model,
      requestId: providerRequestId,
    },
    warnings: warnings ?? [],
    createdAt: now,
    completedAt: now,
  };
}
