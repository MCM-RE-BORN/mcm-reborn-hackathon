import {
  MCM_LEATHER_WIKI_ALWAYS_ON_SAFETY_CONTEXT,
  MCM_LEATHER_WIKI_CORPUS_VERSION,
} from '@/server/knowledge/mcmLeatherWiki';
import { MCM_MATERIAL_REUSE_KNOWLEDGE } from './materialReuseKnowledge';

/**
 * Small, always-on safety boundary for visual material interpretation.
 * Request-specific positive terminology now comes from the local wiki lookup
 * instead of copying every curated claim into every OpenAI request.
 */
export const MCM_PUBLIC_VISUAL_KNOWLEDGE = `MCM public visual evidence boundary (${MCM_LEATHER_WIKI_CORPUS_VERSION})

Evidence priority and scope:
- Customer photographs are the only evidence about the submitted item. Wiki records are terminology and normalization context, never proof of an exact SKU, collection, year, authenticity, composition, origin, or certification.
- Keep broad materialClass, patternCandidate, and surfaceTreatments separate. A visible pattern or finish never proves a substrate, animal species, tanning method, coating chemistry, or authenticity.
- Treat BODY, TRIM, STRAP, and HARDWARE as separate components. Incidental trim or hardware does not make the dominant body material MIXED. Do not infer hidden lining, reinforcement, zipper operation, or hardware composition from exterior still images.
- When only color, grain, gloss, wrinkles, nap, or a repeating motif is visible, report those observations and use UNKNOWN for unsupported substrate or pattern claims.

Always-on wiki safety constraints:
${MCM_LEATHER_WIKI_ALWAYS_ON_SAFETY_CONTEXT}`;

export const MCM_ANALYSIS_KNOWLEDGE = `${MCM_MATERIAL_REUSE_KNOWLEDGE}\n\n${MCM_PUBLIC_VISUAL_KNOWLEDGE}`;
