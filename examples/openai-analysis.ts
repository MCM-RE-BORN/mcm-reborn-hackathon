import { readFile } from 'node:fs/promises';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

export const PRIMARY_DEMO_SCENARIO_KEY =
  'MCM_BACKPACK_CHANGE_APPROVED_20260817' as const;

const ImageQualityIssueCodeSchema = z.enum([
  'BLUR',
  'TOO_DARK',
  'TOO_BRIGHT',
  'GLARE',
  'PRODUCT_CROPPED',
  'INSUFFICIENT_DETAIL',
  'MIXED_PRODUCTS',
]);

const ImageQualityIssueSchema = z.object({
  imageIndex: z.number().int().min(0).max(6),
  code: ImageQualityIssueCodeSchema,
  guidanceKo: z.string().min(1).max(120),
});

const ImageQualitySchema = z.object({
  status: z.enum(['ACCEPTABLE', 'RECAPTURE_REQUIRED']),
  issues: z.array(ImageQualityIssueSchema).max(7),
});

const BagVisionSchema = z.object({
  imageQuality: ImageQualitySchema,
  sourceCategory: z.enum([
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
  ]),
  materialType: z.enum([
    'COATED_CANVAS',
    'LEATHER',
    'NYLON',
    'FABRIC',
    'MIXED',
    'UNKNOWN',
  ]),
  conditionGrade: z.enum(['A', 'B', 'C', 'D']),
  overallDamageSeverity: z.number().int().min(0).max(100),
  longStripAvailable: z.boolean(),
  damages: z.array(
    z.object({
      type: z.enum([
        'SURFACE_SCRATCH',
        'HANDLE_WEAR',
        'EDGE_ABRASION',
        'DISCOLORATION',
        'STAIN',
        'TEAR',
        'PEELING',
        'HARDWARE_DAMAGE',
        'OTHER',
      ]),
      location: z.string().max(80),
      severity: z.number().int().min(0).max(100),
      confidence: z.number().min(0).max(1),
    }),
  ).max(8),
  confidence: z.number().min(0).max(1),
  summaryKo: z.string().max(300),
  authenticityPrecheck: z.object({
    status: z.enum(['ORDER_ELIGIBLE', 'INELIGIBLE']),
    estimatePercent: z.number().int().min(0).max(100),
    notice: z.string().min(1),
  }),
});

export type BagVisionResult = z.infer<typeof BagVisionSchema>;
export type ImageQualityIssue = z.infer<typeof ImageQualityIssueSchema>;
export type ImageQualityIssueCode = z.infer<typeof ImageQualityIssueCodeSchema>;

export class ImageQualityInsufficientError extends Error {
  readonly code = 'IMAGE_QUALITY_INSUFFICIENT';

  constructor(
    readonly issues: readonly ImageQualityIssue[],
  ) {
    super('Submitted images must be recaptured before analysis can continue.');
    this.name = 'ImageQualityInsufficientError';
  }
}

export function isImageQualityInsufficient(
  error: unknown,
): error is ImageQualityInsufficientError {
  return error instanceof ImageQualityInsufficientError;
}

export function assertImageQualityContract(
  result: BagVisionResult,
  imageCount: number,
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

const systemPromptPromise = readFile(
  new URL('../prompts/bag-analysis.system.txt', import.meta.url),
  'utf8',
);

export async function analyzeBagImages(
  imageUrls: readonly string[],
): Promise<{
  result: BagVisionResult;
  estimateMeta: {
    mode: 'LIVE';
    confidencePercent: number;
    notice: string;
  };
  model: string;
  providerRequestId: string;
}> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY_MISSING');
  }
  if (imageUrls.length !== 7) {
    throw new Error('IMAGE_COUNT_OUT_OF_RANGE');
  }

  const systemPrompt = (await systemPromptPromise).trim();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_VISION_MODEL ?? 'gpt-5.6';

  const response = await openai.responses.parse({
    model,
    store: false,
    input: [
      {
        role: 'system',
        content: [{ type: 'input_text', text: systemPrompt }],
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: '첨부 이미지를 정면, 후면, 상단, 하단, 좌측면, 우측면, 일련번호 순서의 동일한 하나의 가방으로 보고 분석하세요.',
          },
          ...imageUrls.map((imageUrl) => ({
            type: 'input_image' as const,
            image_url: imageUrl,
            detail: 'auto' as const,
          })),
        ],
      },
    ],
    text: {
      format: zodTextFormat(BagVisionSchema, 'mcm_reborn_bag_analysis'),
    },
  });

  if (!response.output_parsed) {
    throw new Error('OPENAI_STRUCTURED_OUTPUT_EMPTY');
  }

  assertImageQualityContract(response.output_parsed, imageUrls.length);

  if (response.output_parsed.imageQuality.status === 'RECAPTURE_REQUIRED') {
    throw new ImageQualityInsufficientError(
      response.output_parsed.imageQuality.issues,
    );
  }

  return {
    result: response.output_parsed,
    estimateMeta: {
      mode: 'LIVE',
      confidencePercent: Math.round(response.output_parsed.confidence * 100),
      notice:
        '사진 기반 AI 예상치이며 주문 후 전문가 실물 검수에서 변경될 수 있습니다.',
    },
    model,
    providerRequestId: response.id,
  };
}
