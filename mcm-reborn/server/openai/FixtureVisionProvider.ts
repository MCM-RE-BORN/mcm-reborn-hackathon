import canonicalMockData from '../../../mock-data.json';
import {
  BagVisionSchema,
  ImageQualityIssueCodeSchema,
  type AnalysisModeUsed,
} from '@/contracts/analysis';
import type {
  FixtureEstimateOverrides,
  VisionAnalyzeInput,
  VisionAnalyzeResult,
  VisionProvider,
} from './types';
import { VisionImageQualityError } from './types';

type AnalysisFixture = {
  scenarioKey: string;
  sourceProduct: {
    category: unknown;
    materialType: unknown;
    confidence: unknown;
  };
  condition: {
    grade: unknown;
    overallDamageSeverity: unknown;
    summary: unknown;
  };
  damages: unknown;
  imageQuality: { status: unknown; issues: unknown[] };
  estimateMeta: {
    mode: unknown;
    confidencePercent: number;
    notice: string;
  };
  authenticityPrecheck: FixtureEstimateOverrides['authenticityPrecheck'];
  estimatedReusableMaterialRate: number;
  estimatedReusableAreaCm2: number;
  longStripAvailable: boolean;
  recommendations: FixtureEstimateOverrides['recommendations'];
  esgPreview: FixtureEstimateOverrides['esgPreview'];
  provider: { model?: string };
};

type AnalysisErrorFixture = {
  scenarioKey: string;
  error: {
    details: {
      imageQuality: {
        issues: Array<{
          assetId: string;
          code: unknown;
          guidanceKo: string;
        }>;
      };
    };
  };
};

type MockData = {
  analysisFixtures: AnalysisFixture[];
  analysisErrorFixtures: AnalysisErrorFixture[];
};

// A static import makes Next.js include the canonical fixture in server output
// tracing even when the deployment root is `mcm-reborn/`. Runtime filesystem
// paths based on `process.cwd()` would omit the repository-parent JSON on
// Vercel/standalone deployments.
const mockData = canonicalMockData as unknown as MockData;

/**
 * Reads the canonical v2 fixture shape and normalizes it to the same provider
 * result consumed by LIVE analysis. Derived estimate overrides preserve the
 * deterministic demo values instead of recalculating them from vision fields.
 */
export class FixtureVisionProvider implements VisionProvider {
  constructor(
    private readonly modeUsed: Extract<
      AnalysisModeUsed,
      'DEMO_FIXTURE' | 'SEEDED_ESTIMATE'
    > = 'DEMO_FIXTURE',
  ) {}

  async analyze(input: VisionAnalyzeInput): Promise<VisionAnalyzeResult> {
    const scenarioKey =
      input.demoScenarioKey ?? 'MCM_BACKPACK_CHANGE_APPROVED_20260817';
    const errorFixture = mockData.analysisErrorFixtures.find(
      (fixture) => fixture.scenarioKey === scenarioKey,
    );

    if (errorFixture) {
      throw new VisionImageQualityError(
        errorFixture.error.details.imageQuality.issues.map((issue, index) => ({
          imageIndex: fixtureAssetIndex(issue.assetId, index, input.imageUrls.length),
          code: ImageQualityIssueCodeSchema.parse(issue.code),
          guidanceKo: issue.guidanceKo,
        })),
      );
    }

    const fixture = mockData.analysisFixtures.find(
      (candidate) => candidate.scenarioKey === scenarioKey,
    );
    if (!fixture) {
      throw new Error(`Fixture not found for scenario: ${scenarioKey}`);
    }

    const result = BagVisionSchema.parse({
      imageQuality: fixture.imageQuality,
      sourceCategory: fixture.sourceProduct.category,
      materialType: fixture.sourceProduct.materialType,
      conditionGrade: fixture.condition.grade,
      overallDamageSeverity: fixture.condition.overallDamageSeverity,
      longStripAvailable: fixture.longStripAvailable,
      damages: fixture.damages,
      confidence: fixture.sourceProduct.confidence,
      summaryKo: fixture.condition.summary,
      exteriorMaterialProfile: null,
      authenticityPrecheck: fixture.authenticityPrecheck,
    });

    return {
      result,
      model: fixture.provider.model ?? scenarioKey,
      providerRequestId: null,
      modeUsed: this.modeUsed,
      fixtureEstimate: {
        estimateMeta: {
          ...fixture.estimateMeta,
          mode: this.modeUsed,
        },
        authenticityPrecheck: fixture.authenticityPrecheck,
        estimatedReusableMaterialRate: fixture.estimatedReusableMaterialRate,
        estimatedReusableAreaCm2: fixture.estimatedReusableAreaCm2,
        recommendations: fixture.recommendations,
        esgPreview: fixture.esgPreview,
      },
    };
  }
}

function fixtureAssetIndex(
  assetId: string,
  fallbackIndex: number,
  imageCount: number,
): number {
  const suffix = assetId.match(/([0-9]{12})$/)?.[1];
  const oneBasedIndex = suffix ? Number.parseInt(suffix, 10) : Number.NaN;
  const proposed = Number.isFinite(oneBasedIndex)
    ? oneBasedIndex - 1
    : fallbackIndex;

  return Math.max(0, Math.min(imageCount - 1, proposed));
}
