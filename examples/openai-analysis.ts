import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

const BagVisionSchema = z.object({
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
  authenticitySignal: z.enum(['NOT_EVALUATED', 'REVIEW_REQUIRED']),
});

export type BagVisionResult = z.infer<typeof BagVisionSchema>;

const SYSTEM_PROMPT = `
You are a visual inspection component for an upcycling hackathon prototype.
Analyze all images as views of one bag. Describe only visible evidence.
Never declare authenticity or counterfeit status. Do not calculate product
recommendations, material area, price, or carbon savings. Return only the
structured schema. summaryKo must be concise Korean.
`.trim();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function analyzeBagImages(
  imageUrls: readonly string[],
): Promise<{
  result: BagVisionResult;
  model: string;
  providerRequestId: string;
}> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY_MISSING');
  }
  if (imageUrls.length < 1 || imageUrls.length > 4) {
    throw new Error('IMAGE_COUNT_OUT_OF_RANGE');
  }

  const model = process.env.OPENAI_VISION_MODEL ?? 'gpt-5.6';

  const response = await openai.responses.parse({
    model,
    store: false,
    input: [
      {
        role: 'system',
        content: [{ type: 'input_text', text: SYSTEM_PROMPT }],
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: '첨부 이미지를 동일한 하나의 가방으로 보고 분석하세요.',
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

  return {
    result: response.output_parsed,
    model,
    providerRequestId: response.id,
  };
}
