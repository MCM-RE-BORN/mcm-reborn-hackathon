import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import {
  BagVisionSchema,
  assertImageQualityContract,
} from '@/contracts/analysis';
import type {
  VisionAnalyzeInput,
  VisionAnalyzeResult,
  VisionProvider,
} from './types';

const BAG_ANALYSIS_SYSTEM_PROMPT = `You are the visual inspection component of a service-demo prototype named MCM RE:BORN.
Analyze exactly seven supplied images as ordered views of one customer-owned bag: front, rear, top, bottom, left side, right side, and serial-number detail.

Return only data matching the supplied structured-output schema.

Rules:
1. Describe only visually observable evidence. Do not invent purchase history, serial-number matches, exact product model, manufacturing year, legal status, or official MCM records.
2. Assess whether all seven images are usable before analyzing the bag:
   - Treat the images as a zero-based ordered list. Every imageQuality issue must identify its affected imageIndex from 0 through 6.
   - ACCEPTABLE requires an empty issues array.
   - RECAPTURE_REQUIRED requires at least one issue with short Korean guidanceKo.
   - For RECAPTURE_REQUIRED, keep other classifications conservative. The application discards them and asks for new photos.
3. authenticityPrecheck is only an order-eligibility estimate, never an authentic/counterfeit decision.
   - Use ORDER_ELIGIBLE when the supplied photo evidence is sufficient for the demo order flow.
   - Use INELIGIBLE when it is not sufficient to accept an order.
   - estimatePercent is an integer from 0 to 100 and notice must explicitly say this is not an official authenticity determination.
4. Use UNKNOWN_BAG or UNKNOWN material when uncertain.
5. conditionGrade meaning: A minimal wear, B moderate localized wear, C significant wear with selected reusable panels, D widespread damage.
6. overallDamageSeverity is an integer from 0 to 100. Report at most eight distinct visible damages and avoid duplicates across views.
7. longStripAvailable means a visibly long, continuous, low-damage strip suitable for a strap-like component; use false when uncertain.
8. confidence must reflect image quality and ambiguity. A visible logo alone does not justify high confidence.
9. summaryKo must be neutral Korean no longer than 300 characters.
10. Do not calculate reusable material rate, reusable area, price, recommendations, or carbon savings. The application rule engine calculates those values.`;

/** OpenAI Structured Outputs provider for the LIVE v2 analysis mode. */
export class OpenAiVisionProvider implements VisionProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    this.client = new OpenAI({ apiKey });
    this.model = process.env.OPENAI_VISION_MODEL ?? 'gpt-5.6';
  }

  async analyze(input: VisionAnalyzeInput): Promise<VisionAnalyzeResult> {
    if (input.imageUrls.length !== 7) {
      throw new Error('LIVE analysis requires exactly seven image URLs');
    }

    const completion = await this.client.chat.completions.parse({
      model: this.model,
      messages: [
        { role: 'system', content: BAG_ANALYSIS_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '일곱 이미지를 지정된 순서의 동일 제품으로 보고 분석하세요.',
            },
            ...input.imageUrls.map((url) => ({
              type: 'image_url' as const,
              image_url: { url, detail: 'auto' as const },
            })),
          ],
        },
      ],
      response_format: zodResponseFormat(
        BagVisionSchema,
        'mcm_reborn_bag_analysis_v2',
      ),
    });

    const parsed = completion.choices[0]?.message.parsed;
    if (!parsed) {
      throw new Error('OPENAI_STRUCTURED_OUTPUT_EMPTY');
    }

    assertImageQualityContract(parsed, input.imageUrls.length);

    return {
      result: parsed,
      model: this.model,
      providerRequestId: completion.id,
      modeUsed: 'LIVE',
    };
  }
}
