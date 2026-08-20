import { MCM_PUBLIC_KNOWLEDGE_VERSION } from "@/contracts/exterior-material";
import {
  MCM_MATERIAL_REUSE_KNOWLEDGE,
  MCM_MATERIAL_REUSE_KNOWLEDGE_VERSION,
} from "./materialReuseKnowledge";
import {
  MCM_PUBLIC_GROUNDING_CANONICAL_SHA256,
  MCM_PUBLIC_GROUNDING_CLAIMS,
  MCM_PUBLIC_GROUNDING_VERSION,
} from "./generated/mcmPublicGrounding";

const checkedGroundingVersion: typeof MCM_PUBLIC_KNOWLEDGE_VERSION =
  MCM_PUBLIC_GROUNDING_VERSION;

export const MCM_PUBLIC_KNOWLEDGE_FINGERPRINT =
  MCM_PUBLIC_GROUNDING_CANONICAL_SHA256;

export const MCM_PUBLIC_GROUNDING_CLAIM_IDS = MCM_PUBLIC_GROUNDING_CLAIMS.map(
  ({ id }) => id,
);

export const MCM_ANALYSIS_KNOWLEDGE_VERSION =
  `${MCM_MATERIAL_REUSE_KNOWLEDGE_VERSION}+${checkedGroundingVersion}@${MCM_PUBLIC_KNOWLEDGE_FINGERPRINT}` as const;

const MCM_PUBLIC_ATOMIC_GROUNDING = MCM_PUBLIC_GROUNDING_CLAIMS.map(
  ({ id, text }) => `- [${id}] ${text}`,
).join("\n");

/**
 * Runtime-safe visual rules distilled from the versioned public research set.
 * Source URLs and reference images stay in docs/knowledge-base and are never
 * loaded into a customer request or treated as training/redistribution rights.
 */
export const MCM_PUBLIC_VISUAL_KNOWLEDGE = `MCM public material and pattern grounding (${MCM_PUBLIC_KNOWLEDGE_VERSION})

Evidence priority and scope:
- Customer photographs are the only evidence about the submitted item. This public research is terminology and normalization context, never proof of an exact SKU, collection, year, authenticity, composition, origin, or certification.
- Exact SKU facts outrank collection or pattern facts, which outrank brand-level statements and industry-general knowledge. No exact SKU metadata is supplied here, so keep photo-only classifications broad and lower confidence when boundaries are unclear.
- Official reference-image links in the research set are reference-only and do not grant training, copying, or redistribution rights. Do not retrieve or compare them during this request.

Keep classification axes separate:
- materialClass describes the broad substrate family; patternCandidate describes only a visually consistent pattern family; surfaceTreatments describe visible surface or construction effects. Never use one axis as proof of another.
- Visetos is a pattern family, not a leather type. A representative Visetos body can be coated canvas with separate leather trim, while some distinct leather products use embossed Maxi Visetos. Never map every Visetos-looking surface to leather or to a specific coating resin.
- Canvas does not prove cotton. Nappa does not prove calf. Embossed leather does not prove full-grain leather or an animal species. Natural leather, patent, Vachetta, suede-like appearance, or gloss does not prove a tannage or coating chemistry.
- Microfiber with a suede finish is not animal suede. Use SUEDE_LIKE for visible nap unless trusted supplied metadata establishes the substrate.
- Made in Italy describes final-product assembly only; it does not prove hide origin, material origin, or tannery location. LWG applies to audited facilities, not automatically to a brand or finished bag.

Visual normalization:
- Use pattern candidates only as visually consistent hypotheses: VISETOS, MAXI_VISETOS, LAURETOS, CUBIC_MONOGRAM, DIAMOND_JACQUARD, another monogram or pattern, no distinct pattern, or unknown. A candidate never establishes authenticity or an exact product.
- Keep printed, embossed, croco-embossed, jacquard-woven, quilted, studded, perforated, flocked, cut-out, crushed/distressed, patent-gloss, and suede-like effects separate. Croco-embossed is not evidence of crocodile leather.
- Treat BODY, TRIM, STRAP, and HARDWARE as separate components. Incidental trim or hardware does not make the dominant body material MIXED. Do not infer hidden lining, reinforcement, zipper operation, or hardware composition from exterior still images.
- Resetos regenerated leather may be named only when trusted supplied metadata says so. Photos alone cannot establish its recycled content, binder, animal species, tannage, coating, or vegan status.

When the image supports only color, grain, gloss, wrinkles, or a repeating motif, report those surface observations and use UNKNOWN for unsupported substrate or pattern claims. Use Korean descriptions that distinguish observation from inference.

Curated atomic grounding (build fingerprint ${MCM_PUBLIC_KNOWLEDGE_FINGERPRINT}):
${MCM_PUBLIC_ATOMIC_GROUNDING}`;

export const MCM_ANALYSIS_KNOWLEDGE = `${MCM_MATERIAL_REUSE_KNOWLEDGE}\n\n${MCM_PUBLIC_VISUAL_KNOWLEDGE}`;
