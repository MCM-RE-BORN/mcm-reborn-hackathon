import { z } from 'zod';

/**
 * OpenAPI-aligned enums and schemas for analysis
 */
export const SourceCategorySchema = z.enum([
  'BACKPACK',
  'TOTE_SHOPPER',
  'SHOULDER_CROSSBODY',
  'BUCKET_BAG',
  'TOP_HANDLE',
  'BOSTON_BAG',
  'CLUTCH_POUCH',
  'BELT_BAG',
  'WEEKENDER_DUFFLE',
  'TRAVEL_LUGGAGE',
  'UNKNOWN_BAG',
]);

export const MaterialTypeSchema = z.enum([
  'COATED_CANVAS',
  'LEATHER',
  'NYLON',
  'FABRIC',
  'MIXED',
  'UNKNOWN',
]);

export const ConditionGradeSchema = z.enum(['A', 'B', 'C', 'D']);

export const DamageTypeSchema = z.enum([
  'SURFACE_SCRATCH',
  'HANDLE_WEAR',
  'EDGE_ABRASION',
  'DISCOLORATION',
  'STAIN',
  'TEAR',
  'PEELING',
  'HARDWARE_DAMAGE',
  'OTHER',
]);

export const ImageQualityStatusSchema = z.enum(['ACCEPTABLE', 'RECAPTURE_REQUIRED']);

export const ImageQualityIssueCodeSchema = z.enum([
  'BLUR',
  'TOO_DARK',
  'TOO_BRIGHT',
  'GLARE',
  'PRODUCT_CROPPED',
  'INSUFFICIENT_DETAIL',
  'MIXED_PRODUCTS',
]);

export const AuthenticityPrecheckStatusSchema = z.enum([
  'ORDER_ELIGIBLE',
  'INELIGIBLE',
]);

export const AnalysisModeUsedSchema = z.enum([
  'DEMO_FIXTURE',
  'SEEDED_ESTIMATE',
  'LIVE',
]);

/**
 * OpenAI Structured Output schema
 */
export const ImageQualityIssueSchema = z.object({
  imageIndex: z.number().int().min(0).max(5),
  code: ImageQualityIssueCodeSchema,
  guidanceKo: z.string().min(1).max(120),
});

export const BagVisionSchema = z.object({
  imageQuality: z.object({
    status: ImageQualityStatusSchema,
    issues: z.array(ImageQualityIssueSchema).max(7),
  }),
  sourceCategory: SourceCategorySchema,
  materialType: MaterialTypeSchema,
  conditionGrade: ConditionGradeSchema,
  overallDamageSeverity: z.number().int().min(0).max(100),
  longStripAvailable: z.boolean(),
  damages: z
    .array(
      z.object({
        type: DamageTypeSchema,
        location: z.string().max(80),
        severity: z.number().int().min(0).max(100),
        confidence: z.number().min(0).max(1),
      })
    )
    .max(8),
  confidence: z.number().min(0).max(1),
  summaryKo: z.string().max(300),
  authenticityPrecheck: z.object({
    status: AuthenticityPrecheckStatusSchema,
    estimatePercent: z.number().int().min(0).max(100),
    notice: z.string().min(1).max(300),
  }),
});

export type BagVisionResult = z.infer<typeof BagVisionSchema>;
export type SourceCategory = z.infer<typeof SourceCategorySchema>;
export type MaterialType = z.infer<typeof MaterialTypeSchema>;
export type ConditionGrade = z.infer<typeof ConditionGradeSchema>;
export type ImageQualityIssueCode = z.infer<
  typeof ImageQualityIssueCodeSchema
>;
export type AuthenticityPrecheckStatus = z.infer<
  typeof AuthenticityPrecheckStatusSchema
>;
export type AnalysisModeUsed = z.infer<typeof AnalysisModeUsedSchema>;

/**
 * Validate imageQuality contract:
 * - ACCEPTABLE must have zero issues
 * - RECAPTURE_REQUIRED must have at least one issue
 * - imageIndex must be within bounds
 */
export function assertImageQualityContract(
  result: BagVisionResult,
  imageCount: number
): void {
  const { status, issues } = result.imageQuality;

  if (status === 'ACCEPTABLE' && issues.length !== 0) {
    throw new Error('AI_OUTPUT_INVALID_ACCEPTABLE_WITH_ISSUES');
  }

  if (status === 'RECAPTURE_REQUIRED' && issues.length === 0) {
    throw new Error('AI_OUTPUT_INVALID_RECAPTURE_WITHOUT_ISSUES');
  }

  if (issues.some(({ imageIndex }) => imageIndex >= imageCount)) {
    throw new Error('AI_OUTPUT_INVALID_IMAGE_INDEX');
  }
}
