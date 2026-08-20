import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  ServiceUnavailableError,
  UpstreamError,
  ValidationError,
} from "@/contracts/errors";
import type {
  ExteriorMaterialProfile,
  ExteriorMaterialProfilePart,
} from "@/contracts/exterior-material";
import type { ExteriorMaterialPlan } from "@/lib/texture-preview";
import { MCM_PUBLIC_VISUAL_KNOWLEDGE } from "@/server/openai/analysisKnowledge";

const EXTERIOR_MATERIAL_PLAN_VERSION =
  "MCM_EXTERIOR_MATERIAL_PLAN_V1" as const;
const EXPECTED_VIEWS = ["FRONT", "RIGHT", "REAR", "LEFT"] as const;
const EXPECTED_PARTS = ["BODY", "TRIM", "STRAP", "HARDWARE"] as const;

const EXTERIOR_MATERIAL_DEVELOPER_PROMPT = `You are the exterior-material inspection component of the MCM RE:BORN passport-wallet MVP.
Analyze exactly four labeled exterior photographs of the same source product: FRONT, RIGHT, REAR, and LEFT. Return only data matching the supplied structured-output schema.

Evidence rules:
1. Use only details visibly supported by the supplied photographs. Do not infer hidden surfaces, lining, authenticity, an exact product model, manufacturing history, material composition that cannot be seen, or operational condition from still images.
2. Analyze exterior parts only. Exclude the lining and every other interior surface from this plan.
3. Return exactly four parts in this order: BODY, TRIM, STRAP, HARDWARE. Do not add, remove, merge, or rename a part.
4. BODY means the dominant exterior panels. TRIM means visible exterior edging, piping, or reinforcing patches. STRAP means an externally visible carrying strap. HARDWARE includes visible zipper teeth, zipper pulls, buckles, rings, and other metal fittings.
5. observation must be PRESENT only when the part is clearly visible, NOT_OBSERVED when it is not visible, and UNCERTAIN when the photographs do not support a reliable distinction.
6. evidenceViews must contain only labels that directly support the part assessment. Use an empty array for NOT_OBSERVED. Do not list the same view twice.
7. confidence must be between 0 and 1 and must decrease for blur, glare, occlusion, distance, or ambiguous material boundaries.
8. For NOT_OBSERVED, return an empty colors array and null for materialFamily, patternDescription, and finishDescription. Otherwise describe appearance conservatively and concisely in Korean; do not invent precise dye codes, weave specifications, or finish chemistry.
9. BODY transferMode is always GENERATE_SWATCH. TRIM is GENERATE_SWATCH only when clearly observed and reusable as a distinct appearance reference; otherwise use KEEP_TARGET_PBR. STRAP is always OMIT_FROM_PASSPORT_WALLET. HARDWARE is always KEEP_TARGET_PBR.
10. For every part, semanticMask.status is always UNAVAILABLE and semanticMask.reason is always MESHY_DOES_NOT_RETURN_SEMANTIC_MASK.
11. Never claim that OpenAI, Meshy, these photographs, or this classification produced a UV semantic mask, UV island assignment, mesh-face label, or pixel-accurate cutout. This output is an appearance plan only; a separately authored target UV mask controls final placement.
12. warnings may mention only evidence limitations shared by the four exterior photographs. Never include signed URLs or hidden chain-of-thought.

${MCM_PUBLIC_VISUAL_KNOWLEDGE}`;

const ExteriorViewSchema = z.enum(EXPECTED_VIEWS);

const ExteriorSourceImageSchema = z
  .object({
    signedUrl: z.string().url(),
    view: ExteriorViewSchema,
  })
  .strict();

const ExteriorSourceImagesSchema = z
  .array(ExteriorSourceImageSchema)
  .length(EXPECTED_VIEWS.length)
  .superRefine((images, context) => {
    const views = new Set(images.map((image) => image.view));
    for (const view of EXPECTED_VIEWS) {
      if (!views.has(view)) {
        context.addIssue({
          code: "custom",
          message: `Missing exterior view: ${view}`,
        });
      }
    }
  });

const ObservationSchema = z.enum([
  "PRESENT",
  "NOT_OBSERVED",
  "UNCERTAIN",
]);

const AppearanceSchema = z
  .object({
    colors: z.array(z.string().min(1).max(80)).max(8),
    finishDescription: z.string().min(1).max(300).nullable(),
    materialFamily: z.string().min(1).max(120).nullable(),
    patternDescription: z.string().min(1).max(300).nullable(),
  })
  .strict();

const SemanticMaskSchema = z
  .object({
    reason: z.literal("MESHY_DOES_NOT_RETURN_SEMANTIC_MASK"),
    status: z.literal("UNAVAILABLE"),
  })
  .strict();

const CommonPartFields = {
  appearance: AppearanceSchema,
  confidence: z.number().min(0).max(1),
  evidenceViews: z.array(ExteriorViewSchema).max(EXPECTED_VIEWS.length),
  observation: ObservationSchema,
  semanticMask: SemanticMaskSchema,
};

const ExteriorMaterialPartSchema = z.discriminatedUnion("part", [
  z
    .object({
      ...CommonPartFields,
      part: z.literal("BODY"),
      transferMode: z.literal("GENERATE_SWATCH"),
    })
    .strict(),
  z
    .object({
      ...CommonPartFields,
      part: z.literal("TRIM"),
      transferMode: z.enum(["GENERATE_SWATCH", "KEEP_TARGET_PBR"]),
    })
    .strict(),
  z
    .object({
      ...CommonPartFields,
      part: z.literal("STRAP"),
      transferMode: z.literal("OMIT_FROM_PASSPORT_WALLET"),
    })
    .strict(),
  z
    .object({
      ...CommonPartFields,
      part: z.literal("HARDWARE"),
      transferMode: z.literal("KEEP_TARGET_PBR"),
    })
    .strict(),
]);

export const ExteriorMaterialPlanSchema = z
  .object({
    parts: z
      .array(ExteriorMaterialPartSchema)
      .length(EXPECTED_PARTS.length),
    schemaVersion: z.literal(EXTERIOR_MATERIAL_PLAN_VERSION),
    sourceEvidence: z.literal("PHOTOS"),
    warnings: z.array(z.string().min(1).max(300)).max(8),
  })
  .strict()
  .superRefine((plan, context) => {
    plan.parts.forEach((part, index) => {
      if (part.part !== EXPECTED_PARTS[index]) {
        context.addIssue({
          code: "custom",
          message: `Part at index ${index} must be ${EXPECTED_PARTS[index]}`,
          path: ["parts", index, "part"],
        });
      }

      if (new Set(part.evidenceViews).size !== part.evidenceViews.length) {
        context.addIssue({
          code: "custom",
          message: "evidenceViews must not contain duplicates",
          path: ["parts", index, "evidenceViews"],
        });
      }

      if (
        part.observation === "NOT_OBSERVED" &&
        (part.evidenceViews.length > 0 ||
          part.appearance.colors.length > 0 ||
          part.appearance.materialFamily !== null ||
          part.appearance.patternDescription !== null ||
          part.appearance.finishDescription !== null)
      ) {
        context.addIssue({
          code: "custom",
          message: "NOT_OBSERVED parts must not include appearance evidence",
          path: ["parts", index],
        });
      }

      if (
        part.observation !== "NOT_OBSERVED" &&
        part.evidenceViews.length === 0
      ) {
        context.addIssue({
          code: "custom",
          message: "Observed parts require at least one evidence view",
          path: ["parts", index, "evidenceViews"],
        });
      }
    });
  });

export type ExteriorMaterialSourceImage = z.infer<
  typeof ExteriorSourceImageSchema
>;

/** OpenAI Structured Outputs classifier for the four-view exterior plan. */
export class ExteriorMaterialClassifier {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const model = process.env.OPENAI_VISION_MODEL?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableError(
        "OpenAI exterior material classification is not configured",
        { retryable: false },
      );
    }

    this.client = new OpenAI({ apiKey, maxRetries: 0, timeout: 120_000 });
    this.model = model || "gpt-5.6";
  }

  async classify(
    sourceImages: readonly ExteriorMaterialSourceImage[],
  ): Promise<ExteriorMaterialPlan> {
    const parsedInput = ExteriorSourceImagesSchema.safeParse(sourceImages);
    if (!parsedInput.success) {
      throw new ValidationError(
        "Exterior material classification requires FRONT, RIGHT, REAR, and LEFT images",
        { issues: parsedInput.error.issues },
      );
    }

    const imagesByView = new Map(
      parsedInput.data.map((image) => [image.view, image] as const),
    );
    const orderedImages = EXPECTED_VIEWS.map(
      (view) => imagesByView.get(view)!,
    );

    try {
      const completion = await this.client.chat.completions.parse({
        messages: [
          {
            content: EXTERIOR_MATERIAL_DEVELOPER_PROMPT,
            role: "developer",
          },
          {
            content: [
              {
                text: "각 VIEW 라벨 바로 다음 사진만 그 라벨의 시점 증거로 사용해 외관 소재 계획을 작성하세요.",
                type: "text",
              },
              ...orderedImages.flatMap(({ signedUrl, view }) => [
                { text: `VIEW: ${view}`, type: "text" as const },
                {
                  image_url: {
                    detail: "high" as const,
                    url: signedUrl,
                  },
                  type: "image_url" as const,
                },
              ]),
            ],
            role: "user",
          },
        ],
        model: this.model,
        response_format: zodResponseFormat(
          ExteriorMaterialPlanSchema,
          EXTERIOR_MATERIAL_PLAN_VERSION,
        ),
      });

      const plan = completion.choices[0]?.message.parsed;
      if (!plan) {
        throw new Error("OPENAI_EXTERIOR_MATERIAL_PLAN_EMPTY");
      }

      return ExteriorMaterialPlanSchema.parse(plan);
    } catch {
      throw new UpstreamError(
        "OpenAI exterior material classification failed",
      );
    }
  }
}

export function isExteriorMaterialClassifierConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

const PROFILE_INDEX_TO_VIEW = {
  0: "FRONT",
  1: "REAR",
  4: "LEFT",
  5: "RIGHT",
} as const;

const PROFILE_PART_ORDER = ["BODY", "TRIM", "STRAP", "HARDWARE"] as const;

const MATERIAL_CLASS_LABELS: Record<
  ExteriorMaterialProfilePart["appearance"]["materialClass"],
  string
> = {
  COATED_CANVAS: "코티드 캔버스",
  LEATHER: "가죽",
  METAL: "금속",
  NYLON: "나일론",
  OTHER: "기타 외관 소재",
  TEXTILE: "직물",
  UNKNOWN: "확인되지 않음",
};

const PATTERN_CANDIDATE_LABELS: Record<
  ExteriorMaterialProfilePart["appearance"]["patternCandidate"],
  string | null
> = {
  CUBIC_MONOGRAM: "Cubic Monogram 계열로 보이는 패턴",
  DIAMOND_JACQUARD: "Diamond Jacquard 계열로 보이는 패턴",
  LAURETOS: "Lauretos 계열로 보이는 패턴",
  MAXI_VISETOS: "Maxi Visetos 계열로 보이는 패턴",
  NO_DISTINCT_PATTERN: "뚜렷한 반복 패턴이 관찰되지 않음",
  OTHER_MONOGRAM: "기타 모노그램 계열로 보이는 패턴",
  OTHER_PATTERN: "기타 반복 패턴",
  UNKNOWN: null,
  VISETOS: "Visetos 계열로 보이는 패턴",
};

const SURFACE_TREATMENT_LABELS: Record<
  ExteriorMaterialProfilePart["appearance"]["surfaceTreatments"][number],
  string
> = {
  CROCO_EMBOSSED: "크로코 엠보싱",
  CRUSHED_DISTRESSED: "크러시드·디스트레스드",
  CUT_OUT: "컷아웃",
  EMBOSSED: "엠보싱",
  FLOCKED: "플로킹",
  JACQUARD_WOVEN: "자카드 직조",
  OTHER: "기타 표면 처리",
  PATENT_GLOSS: "페이턴트 광택",
  PERFORATED: "퍼포레이션",
  PLAIN: "별도 가공이 뚜렷하지 않음",
  PRINTED: "프린트",
  QUILTED: "퀼팅",
  STUDDED: "스터드",
  SUEDE_LIKE: "스웨이드와 유사한 기모",
  UNKNOWN: "표면 처리 확인 필요",
};

/**
 * Reuses the material profile produced by the six-view analysis. Transfer
 * modes and semantic-mask limitations remain deterministic application rules,
 * so the model is not asked to invent UV or mesh semantics a second time.
 */
export function exteriorMaterialPlanFromProfile(
  profile: ExteriorMaterialProfile,
): ExteriorMaterialPlan {
  return ExteriorMaterialPlanSchema.parse({
    parts: PROFILE_PART_ORDER.map((partName) => {
      const part = profile.parts[partName];
      const transferMode =
        partName === "BODY"
          ? "GENERATE_SWATCH"
          : partName === "TRIM"
            ? part.observation === "PRESENT" &&
              part.confidence >= 0.55 &&
              part.appearance.materialClass !== "UNKNOWN"
              ? "GENERATE_SWATCH"
              : "KEEP_TARGET_PBR"
            : partName === "STRAP"
              ? "OMIT_FROM_PASSPORT_WALLET"
              : "KEEP_TARGET_PBR";

      return {
        appearance: {
          colors: part.appearance.colors,
          finishDescription:
            part.appearance.finishDescription ??
            (part.appearance.surfaceTreatments.length > 0
              ? part.appearance.surfaceTreatments
                  .map((treatment) => SURFACE_TREATMENT_LABELS[treatment])
                  .join(", ")
              : null),
          materialFamily:
            part.observation === "NOT_OBSERVED"
              ? null
              : (part.appearance.materialDescription ??
                MATERIAL_CLASS_LABELS[part.appearance.materialClass]),
          patternDescription:
            part.appearance.patternDescription ??
            PATTERN_CANDIDATE_LABELS[part.appearance.patternCandidate],
        },
        confidence: part.confidence,
        evidenceViews: [
          ...new Set(
            part.evidenceImageIndexes.map(
              (index) => PROFILE_INDEX_TO_VIEW[index],
            ),
          ),
        ],
        observation: part.observation,
        part: partName,
        semanticMask: {
          reason: "MESHY_DOES_NOT_RETURN_SEMANTIC_MASK",
          status: "UNAVAILABLE",
        },
        transferMode,
      };
    }),
    schemaVersion: EXTERIOR_MATERIAL_PLAN_VERSION,
    sourceEvidence: "PHOTOS",
    warnings: profile.warnings,
  });
}
