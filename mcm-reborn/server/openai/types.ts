import type {
  AnalysisModeUsed,
  BagVisionResult,
  ImageQualityIssueCode,
} from '@/contracts/analysis';

export interface VisionAnalyzeInput {
  imageUrls: string[];
  demoScenarioKey?: string | null;
}

export interface FixtureEstimateOverrides {
  authenticityPrecheck: BagVisionResult['authenticityPrecheck'];
  esgPreview: {
    methodologyVersion: 'DEMO_LCA_V2';
    estimatedCarbonSavingKgCo2e: number;
    disclaimer: string;
  };
  estimateMeta: {
    mode: AnalysisModeUsed;
    confidencePercent: number;
    notice: string;
  };
  estimatedReusableAreaCm2: number;
  estimatedReusableMaterialRate: number;
  recommendations: Array<{
    productId: string;
    productCode: string;
    eligible: boolean;
    score: number;
    estimatedReusableMaterialRate: number;
    reasonCodes: string[];
  }>;
}

export interface VisionAnalyzeResult {
  result: BagVisionResult;
  model: string;
  providerRequestId: string | null;
  modeUsed: AnalysisModeUsed;
  knowledgeVersion?: string;
  fixtureEstimate?: FixtureEstimateOverrides;
  warnings?: Array<{ code: string; message: string }>;
}

export interface VisionProvider {
  analyze(input: VisionAnalyzeInput): Promise<VisionAnalyzeResult>;
}

export class VisionImageQualityError extends Error {
  constructor(
    public readonly issues: Array<{
      imageIndex: number;
      code: ImageQualityIssueCode;
      guidanceKo: string;
    }>,
  ) {
    super('IMAGE_QUALITY_INSUFFICIENT');
    this.name = 'VisionImageQualityError';
  }
}
