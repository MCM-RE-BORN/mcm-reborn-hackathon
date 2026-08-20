export const MCM_MATERIAL_REUSE_KNOWLEDGE_VERSION =
  'MCM_REUSE_GUIDE_2026_08_21_V1';

/**
 * Runtime domain grounding distilled from the supplied "AI 학습 파일.pdf".
 *
 * Keep this reference concise and evidence-bound. It is context for interpreting
 * visible bag materials and components, never a substitute for what the six
 * customer images actually show.
 */
export const MCM_MATERIAL_REUSE_KNOWLEDGE = `MCM material and reuse reference (${MCM_MATERIAL_REUSE_KNOWLEDGE_VERSION})

Evidence boundary:
- This reference is supporting domain context, not visual evidence.
- Apply a material or component rule only when the supplied images support it.
- Never infer an exact product family, authenticity, hidden construction, or material subtype from a logo, color, silhouette, or this reference alone.
- Exterior appearance alone is not reliable evidence for distinguishing Nappa, calf, and calf Nappa. Map them to LEATHER and do not name an exact subtype unless a legible label or trusted supplied metadata explicitly supports it.
- When evidence is ambiguous, use the broader allowed materialType or UNKNOWN and lower confidence. Incidental trim or hardware alone does not make the dominant material MIXED.

Material families:
- Visetos coated canvas is coated canvas, not leather. It is commonly used for the main bag body. Map visually supported Visetos coated canvas to COATED_CANVAS, preserve the signature pattern when assessing reusable areas, and prefer sufficiently large low-damage body panels for a new product's main body.
- Nappa leather is soft and flexible. It is commonly used for handles, straps, edges, and trim. Potential reuse includes handles, straps, edges, and pockets when condition and continuous area are sufficient.
- Calf leather typically has a fine-grained, comparatively smooth and uniform surface. It is commonly used for bodies, flaps, and handles. Potential reuse includes main panels, flaps, pockets, and card cases when visually supported.
- Calf Nappa leather combines calf leather with a Nappa-style finish. It is commonly used for trim, handles, edges, and flaps. Potential reuse includes edges, handles, pockets, and flaps when visually supported.
- Nappa, calf, and calf Nappa all map to the broad LEATHER enum.

Bag components and reuse checks:
- Main body: usually the largest reusable surface. Assess coating or leather condition, available continuous area, and whether a visible signature pattern can be preserved.
- Leather trim: inspect borders, handles, and pockets separately from the main body. Reuse only low-damage sections for edges, pockets, handles, or straps.
- Zipper: assess visible teeth, slider, tape, and apparent alignment. Do not claim that it operates from still images; mark visible damage and keep the judgment conservative. A visibly damaged zipper should be treated as replaceable rather than reusable. Use HARDWARE_DAMAGE for visible zipper or hardware damage when it is the closest allowed damage type.
- Metal hardware: inspect logos, buckles, D-rings, chains, and connectors. Reuse is plausible only when the visible shape and surface condition are sound; otherwise record the damage.
- Strap: distinguish leather from webbing where visible. longStripAvailable may be true only when a sufficiently long, continuous, low-damage section is actually visible for a handle, crossbody strap, or wrist strap.
- Lining: cotton, microfiber, or another lining may be reusable only after visible stain and wear assessment. Do not infer cleanliness or hidden condition from exterior views. If the lining is not visible, do not invent lining damage and mention the limitation in summaryKo when material to the estimate.

Condition-to-reuse interpretation:
- Grade A / good condition: a sufficiently large low-damage exterior area may support main-material reuse.
- Grade B / usable wear: prefer small applications such as pockets, tags, trim, or card-case pieces.
- Grade C / partial damage: select only visibly undamaged sections and exclude damaged regions.
- Grade D / severe damage: widespread severe damage in the dominant material excludes it from production reuse and requires separate handling.
- An isolated damaged zipper, buckle, or other accessory does not by itself make the whole bag grade D. Base the overall grade on the dominant reusable surface and remaining continuous area, and record component damage separately.
- In every case, actual reuse depends on both condition and obtainable continuous area; photo analysis is an estimate that requires later physical inspection.

Apply this reference to materialType, component-specific damage locations, conditionGrade, overallDamageSeverity, longStripAvailable, confidence, and summaryKo. Use canonical component names such as main body, leather trim, zipper, metal hardware, strap, and lining in damage locations. summaryKo should briefly identify the strongest visually supported reuse candidate, any important exclusion, and material uncertainty without promising production feasibility.`;
