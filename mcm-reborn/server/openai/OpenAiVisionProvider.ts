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
import {
  MCM_ANALYSIS_KNOWLEDGE,
  MCM_ANALYSIS_KNOWLEDGE_VERSION,
} from './analysisKnowledge';

const ORDERED_IMAGE_VIEWS = [
  'FRONT',
  'REAR',
  'TOP',
  'BOTTOM',
  'LEFT',
  'RIGHT',
] as const;

const BAG_ANALYSIS_DEVELOPER_PROMPT = `You are the visual inspection component of a service-demo prototype named MCM RE:BORN.
Analyze exactly six supplied images as ordered views of one customer-owned bag: front, rear, top, bottom, left side, and right side.

Return only data matching the supplied structured-output schema.

Rules:
1. Describe only visually observable evidence. Do not invent purchase history, serial-number matches, exact product model, manufacturing year, legal status, or official MCM records.
2. Assess whether all six images are usable before analyzing the bag:
   - Treat the images as a zero-based ordered list. Every imageQuality issue must identify its affected imageIndex from 0 through 5.
   - ACCEPTABLE requires an empty issues array.
   - RECAPTURE_REQUIRED requires at least one issue with short Korean guidanceKo.
   - For RECAPTURE_REQUIRED, keep other classifications conservative. The application discards them and asks for new photos.
3. authenticityPrecheck is only an order-eligibility estimate, never an authentic/counterfeit decision.
   - Use ORDER_ELIGIBLE when the supplied photo evidence is sufficient for the demo order flow.
   - Use INELIGIBLE when it is not sufficient to accept an order.
   - estimatePercent is an integer from 0 to 100 and notice must explicitly say this is not an official authenticity determination.
4. Use UNKNOWN_BAG or UNKNOWN material when uncertain.
5. conditionGrade describes the dominant reusable surface, not the worst isolated accessory: A has a sufficiently large low-damage main surface; B has visible wear and mainly supports small applications such as pockets, tags, or trim; C has partial damage and only visibly undamaged sections are selectable; D has widespread severe damage in the dominant material and excludes it from production reuse.
6. overallDamageSeverity is an integer from 0 to 100. Report at most eight distinct visible damages and avoid duplicates across views.
7. longStripAvailable means a visibly long, continuous, low-damage strip suitable for a strap-like component; use false when uncertain.
8. confidence must reflect image quality and ambiguity. A visible logo alone does not justify high confidence.
9. summaryKo must be neutral Korean no longer than 300 characters.
10. Use the appended versioned MCM references when interpreting visually supported materials, components, patterns, surface treatments, damage locations, reusable condition, and continuous area. They never override the evidence boundary in rule 1.
11. exteriorMaterialProfile is a reusable photo-grounded classification for the later passport-wallet texture workflow:
   - For ACCEPTABLE images, return a non-null profile with exactly the BODY, TRIM, STRAP, and HARDWARE object keys. BODY must be PRESENT with direct evidence; otherwise return a null profile instead of inventing a usable body reference.
   - Use only exterior evidence image indexes 0 (FRONT), 1 (REAR), 4 (LEFT), and 5 (RIGHT). TOP and BOTTOM must not appear in evidenceImageIndexes.
   - Separate broad materialClass, visually consistent patternCandidate, and visible surfaceTreatments. Do not turn a pattern candidate into a material or authenticity claim.
   - Use NOT_OBSERVED with empty evidence and unknown/empty appearance fields when a part is not visible. Use UNCERTAIN rather than inventing a boundary or substrate.
   - This profile is appearance evidence only. It does not create a UV mask, mesh label, cut pattern, or pixel-accurate segmentation.
   - For RECAPTURE_REQUIRED, exteriorMaterialProfile may be null.
12. Do not calculate reusable material rate, reusable area, price, recommendations, or carbon savings. The application rule engine calculates those values.`;

const LIVE_ANALYSIS_DEVELOPER_PROMPT = `${BAG_ANALYSIS_DEVELOPER_PROMPT}\n\n${MCM_ANALYSIS_KNOWLEDGE}`;

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
    if (input.imageUrls.length !== 6) {
      throw new Error('LIVE analysis requires exactly six image URLs');
    }

    const completion = await this.client.chat.completions.parse({
      model: this.model,
      messages: [
        { role: 'developer', content: LIVE_ANALYSIS_DEVELOPER_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '각 VIEW 라벨 바로 다음 이미지만 해당 시점의 증거로 사용하고, 여섯 장을 동일 제품으로 분석하세요.',
            },
            ...input.imageUrls.flatMap((url, index) => [
              {
                type: 'text' as const,
                text: `IMAGE_INDEX: ${index}; VIEW: ${ORDERED_IMAGE_VIEWS[index]}`,
              },
              {
                type: 'image_url' as const,
                image_url: { url, detail: 'auto' as const },
              },
            ]),
          ],
        },
      ],
      response_format: zodResponseFormat(
        BagVisionSchema,
        'mcm_reborn_bag_analysis_v3',
      ),
    });

    const parsed = completion.choices[0]?.message.parsed;
    if (!parsed) {
      throw new Error('OPENAI_STRUCTURED_OUTPUT_EMPTY');
    }

    assertImageQualityContract(parsed, input.imageUrls.length);
    if (
      parsed.imageQuality.status === 'ACCEPTABLE' &&
      !parsed.exteriorMaterialProfile
    ) {
      throw new Error('OPENAI_EXTERIOR_MATERIAL_PROFILE_EMPTY');
    }
    return {
      result: parsed,
      model: this.model,
      providerRequestId: completion.id,
      modeUsed: 'LIVE',
      knowledgeVersion: MCM_ANALYSIS_KNOWLEDGE_VERSION,
    };
  }
}
