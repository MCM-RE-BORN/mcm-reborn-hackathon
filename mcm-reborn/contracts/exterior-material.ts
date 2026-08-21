import { z } from "zod";

export const MCM_PUBLIC_KNOWLEDGE_VERSION =
  "MCM_LEATHER_BAGS_PUBLIC_RESEARCH_2026_08_21_V1" as const;

export const EXTERIOR_MATERIAL_PROFILE_VERSION =
  "MCM_EXTERIOR_MATERIAL_PROFILE_V2" as const;

export const ExteriorMaterialClassSchema = z.enum([
  "COATED_CANVAS",
  "LEATHER",
  "TEXTILE",
  "NYLON",
  "METAL",
  "OTHER",
  "UNKNOWN",
]);

export const ExteriorPatternCandidateSchema = z.enum([
  "VISETOS",
  "MAXI_VISETOS",
  "LAURETOS",
  "CUBIC_MONOGRAM",
  "DIAMOND_JACQUARD",
  "OTHER_MONOGRAM",
  "OTHER_PATTERN",
  "NO_DISTINCT_PATTERN",
  "UNKNOWN",
]);

export const ExteriorSurfaceTreatmentSchema = z.enum([
  "PRINTED",
  "EMBOSSED",
  "CROCO_EMBOSSED",
  "JACQUARD_WOVEN",
  "QUILTED",
  "STUDDED",
  "PERFORATED",
  "FLOCKED",
  "CUT_OUT",
  "CRUSHED_DISTRESSED",
  "PATENT_GLOSS",
  "SUEDE_LIKE",
  "PLAIN",
  "OTHER",
  "UNKNOWN",
]);

const ExteriorEvidenceImageIndexSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(4),
  z.literal(5),
]);

const ObservedExteriorAppearanceSchema = z
  .object({
    colors: z.array(z.string().min(1).max(80)).max(8),
    finishDescription: z.string().min(1).max(300).nullable(),
    materialClass: ExteriorMaterialClassSchema,
    materialDescription: z.string().min(1).max(120).nullable(),
    patternCandidate: ExteriorPatternCandidateSchema,
    patternDescription: z.string().min(1).max(300).nullable(),
    surfaceTreatments: z.array(ExteriorSurfaceTreatmentSchema).max(6),
  })
  .strict();

const NotObservedExteriorAppearanceSchema = z
  .object({
    colors: z.array(z.string().min(1).max(80)).max(0),
    finishDescription: z.null(),
    materialClass: z.literal("UNKNOWN"),
    materialDescription: z.null(),
    patternCandidate: z.literal("UNKNOWN"),
    patternDescription: z.null(),
    surfaceTreatments: z.array(ExteriorSurfaceTreatmentSchema).max(0),
  })
  .strict();

const ObservedExteriorPartFields = {
  appearance: ObservedExteriorAppearanceSchema,
  confidence: z.number().min(0).max(1),
  evidenceImageIndexes: z
    .array(ExteriorEvidenceImageIndexSchema)
    .min(1)
    .max(4),
};

const PresentExteriorMaterialProfilePartSchema = z
  .object({
    ...ObservedExteriorPartFields,
    observation: z.literal("PRESENT"),
  })
  .strict();

const ExteriorMaterialProfilePartSchema = z.discriminatedUnion(
  "observation",
  [
    PresentExteriorMaterialProfilePartSchema,
    z
      .object({
        ...ObservedExteriorPartFields,
        observation: z.literal("UNCERTAIN"),
      })
      .strict(),
    z
      .object({
        appearance: NotObservedExteriorAppearanceSchema,
        confidence: z.number().min(0).max(1),
        evidenceImageIndexes: z
          .array(ExteriorEvidenceImageIndexSchema)
          .max(0),
        observation: z.literal("NOT_OBSERVED"),
      })
      .strict(),
  ],
);

const ExteriorMaterialProfilePartsSchema = z
  .object({
    BODY: PresentExteriorMaterialProfilePartSchema,
    TRIM: ExteriorMaterialProfilePartSchema,
    STRAP: ExteriorMaterialProfilePartSchema,
    HARDWARE: ExteriorMaterialProfilePartSchema,
  })
  .strict();

export const ExteriorMaterialProfileSchema = z
  .object({
    knowledgeVersion: z.literal(MCM_PUBLIC_KNOWLEDGE_VERSION),
    parts: ExteriorMaterialProfilePartsSchema,
    profileVersion: z.literal(EXTERIOR_MATERIAL_PROFILE_VERSION),
    sourceEvidence: z.literal("SIX_ORDERED_PHOTOS"),
    warnings: z.array(z.string().min(1).max(300)).max(8),
  })
  .strict();

export type ExteriorMaterialProfilePart = z.infer<
  typeof ExteriorMaterialProfilePartSchema
>;

export type ExteriorMaterialProfile = z.infer<
  typeof ExteriorMaterialProfileSchema
>;
