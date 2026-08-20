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
- When evidence is ambiguous, use the broader allowed materialType or UNKNOWN and lower confidence.

Material families:
- Visetos coated canvas is coated canvas, not leather. It is commonly used for the main bag body. Map visually supported Visetos coated canvas to COATED_CANVAS, preserve the signature pattern when assessing reusable areas, and prefer sufficiently large low-damage body panels for a new product's main body.
- Nappa leather is soft and flexible. It is commonly used for handles, straps, edges, and trim. Potential reuse includes handles, straps, edges, and pockets when condition and continuous area are sufficient.
- Calf leather typically has a fine-grained, comparatively smooth and uniform surface. It is commonly used for bodies, flaps, and handles. Potential reuse includes main panels, flaps, pockets, and card cases when visually supported.
- Calf Nappa leather combines calf leather with a Nappa-style finish. It is commonly used for trim, handles, edges, and flaps. Potential reuse includes edges, handles, pockets, and flaps when visually supported.
- Nappa, calf, and calf Nappa all map to the broad LEATHER enum. Do not claim a subtype unless its visual characteristics are sufficiently distinguishable.

Bag components and reuse checks:
- Main body: usually the largest reusable surface. Assess coating or leather condition, available continuous area, and whether a visible signature pattern can be preserved.
- Leather trim: inspect borders, handles, and pockets separately from the main body. Reuse only low-damage sections for edges, pockets, handles, or straps.
- Zipper: assess visible teeth, slider, tape, and apparent alignment. Do not claim that it operates from still images; mark visible damage and keep the judgment conservative. A visibly damaged zipper should be treated as replaceable rather than reusable.
- Metal hardware: inspect logos, buckles, D-rings, chains, and connectors. Reuse is plausible only when the visible shape and surface condition are sound; otherwise record the damage.
- Strap: distinguish leather from webbing where visible. longStripAvailable may be true only when a sufficiently long, continuous, low-damage section is actually visible for a handle, crossbody strap, or wrist strap.
- Lining: cotton, microfiber, or another lining may be reusable only after visible stain and wear assessment. Do not infer cleanliness or hidden condition from exterior views.

Condition-to-reuse interpretation:
- Good condition: a sufficiently large low-damage exterior area may support main-material reuse.
- Usable wear: prefer small applications such as pockets, tags, trim, or card-case pieces.
- Partial damage: select only visibly undamaged sections and exclude damaged regions.
- Severe damage: exclude the affected material or component from production reuse and treat it separately.
- In every case, actual reuse depends on both condition and obtainable continuous area; photo analysis is an estimate that requires later physical inspection.

Apply this reference to materialType, component-specific damage locations, conditionGrade, overallDamageSeverity, longStripAvailable, confidence, and summaryKo. summaryKo should briefly identify the strongest visually supported reuse candidate and any important exclusion without promising production feasibility.`;
