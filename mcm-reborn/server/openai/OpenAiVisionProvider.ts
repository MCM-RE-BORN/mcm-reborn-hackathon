import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import {
  BagVisionSchema,
  BagVisionResult,
  assertImageQualityContract,
} from '@/contracts/analysis';
import { ImageQualityInsufficientError } from '@/contracts/errors';

const BAG_ANALYSIS_SYSTEM_PROMPT = `You are the visual inspection component of a hackathon prototype named MCM RE:BORN.
Analyze all supplied images as different views of one customer-owned bag.

Return only data matching the supplied structured-output schema.

Rules:
1. Describe only visually observable evidence. Do not invent purchase history, serial-number matches, exact product model, manufacturing year, legal status, or official MCM records.
2. Assess whether the images are usable before analyzing the bag:
   - Treat the supplied images as a zero-based ordered list. Each imageQuality issue must identify the affected imageIndex.
   - Set imageQuality.status to ACCEPTABLE only when the same product is sufficiently visible for a cautious analysis. Then return an empty issues array.
   - Set imageQuality.status to RECAPTURE_REQUIRED when any supplied image set is too blurry, dark, bright, reflective, cropped, lacks useful detail, or appears to contain different products.
   - Each imageQuality issue contains imageIndex, code, and a short Korean guidanceKo. code may be only BLUR, TOO_DARK, TOO_BRIGHT, GLARE, PRODUCT_CROPPED, INSUFFICIENT_DETAIL, or MIXED_PRODUCTS.
   - For RECAPTURE_REQUIRED, keep all other classifications conservative with low confidence. The application will discard those classifications and ask for new photos.
3. Never declare an item authentic or counterfeit. Set authenticitySignal to NOT_EVALUATED unless the images are too ambiguous or suspicious for the demo flow, in which case use REVIEW_REQUIRED. REVIEW_REQUIRED means manual review only and must never be presented as a counterfeit decision.
4. Classify sourceCategory using the allowed enum. Use UNKNOWN_BAG when uncertain.
5. Classify materialType using the allowed enum. Use UNKNOWN when uncertain.
6. conditionGrade meaning:
   - A: minimal wear; most visible material appears reusable.
   - B: moderate localized wear; large reusable panels remain.
   - C: significant wear; only selected panels are reusable.
   - D: widespread damage; mostly small remnants may be reusable.
7. overallDamageSeverity must be an integer from 0 to 100.
8. Report at most eight distinct visible damages. Avoid duplicates across views.
9. longStripAvailable means a visibly long, continuous, low-damage strip suitable for a strap-like component. Use false when uncertain.
10. confidence must reflect image quality and ambiguity. Do not use a high confidence merely because a logo is visible.
11. summaryKo must be Korean, neutral, concise, and no longer than 300 characters.
12. Do not calculate reusable material rate, reusable area, price, product recommendations, or carbon savings. Those are calculated by the application rule engine.`;

export interface AnalyzeInput {
  imageUrls: string[];
}

export interface AnalyzeResult {
  result: BagVisionResult;
  model: string;
  providerRequestId: string | null;
  modeUsed: 'LIVE';
}

/**
 * OpenAI Vision Provider for bag analysis
 */
export class OpenAiVisionProvider {
  private client: OpenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    this.client = new OpenAI({ apiKey });
    this.model = process.env.OPENAI_VISION_MODEL ?? 'gpt-4o';
  }

  async analyze(input: AnalyzeInput): Promise<AnalyzeResult> {
    const { imageUrls } = input;

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: BAG_ANALYSIS_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '첨부 이미지를 하나의 동일 제품으로 보고 분석하세요.',
            },
            ...imageUrls.map((url) => ({
              type: 'image_url' as const,
              image_url: {
                url,
                detail: 'auto' as const,
              },
            })),
          ],
        },
      ],
      response_format: zodResponseFormat(BagVisionSchema, 'mcm_reborn_bag_analysis'),
    }) as { id: string; choices: Array<{ message?: { parsed?: unknown } }> };

    const parsed = completion.choices[0]?.message?.parsed as BagVisionResult | undefined;

    if (!parsed) {
      throw new Error('OPENAI_STRUCTURED_OUTPUT_EMPTY');
    }

    // Validate image quality contract
    assertImageQualityContract(parsed, imageUrls.length);

    // If image quality is insufficient, throw error with asset mapping
    if (parsed.imageQuality.status === 'RECAPTURE_REQUIRED') {
      // Note: imageIndex to assetId mapping should be done at the API layer
      throw new ImageQualityInsufficientError(
        parsed.imageQuality.issues.map((issue) => ({
          assetId: '', // Will be filled by API layer
          code: issue.code,
          guidanceKo: issue.guidanceKo,
        }))
      );
    }

    return {
      result: parsed,
      model: this.model,
      providerRequestId: completion.id,
      modeUsed: 'LIVE',
    };
  }
}
