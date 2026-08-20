import 'server-only';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import wikiSnapshotJson from './mcmLeatherWiki.generated.json';

const ClaimTopicSchema = z.enum([
  'history',
  'pattern',
  'design',
  'material',
  'leather_type',
  'construction',
  'process',
  'sourcing',
  'sustainability',
  'care',
  'legal',
  'unknown',
]);

export const McmLeatherWikiLookupSchema = z.object({
  terms: z.array(z.string().trim().min(2).max(60)).min(1).max(8),
  topics: z.array(ClaimTopicSchema).max(4),
  includeProductExamples: z.boolean(),
});

export type McmLeatherWikiLookup = z.infer<
  typeof McmLeatherWikiLookupSchema
>;

type SourceRecord = {
  source_id: string;
  publisher: string;
  title: string;
  url: string;
  source_class: string;
  authority_grade: string;
  published_at: string | null;
  date_precision: string;
  observed_at: string;
};

type EvidenceRecord = {
  source_id: string;
  locator: string;
  support: 'supports' | 'contradicts' | 'context_only';
};

type TimeContext = {
  label: string;
  start: string | null;
  end: string | null;
  precision: string;
  status: string;
};

type ClaimRecord = {
  claim_id: string;
  topic: z.infer<typeof ClaimTopicSchema>;
  subject: string;
  claim_ko: string;
  fact_scope: string;
  claim_owner: string;
  evidence_mode: string;
  confidence: string;
  valid_time: TimeContext;
  observed_at: string;
  evidence: EvidenceRecord[];
  conflict_group_id: string | null;
  ai_use: 'grounding' | 'context_only' | 'negative_constraint' | 'exclude';
  notes: string;
};

type AttributeState = Record<string, 'reported' | 'unknown' | 'not_applicable'>;

type ProductComponent = {
  role: string;
  material_class: string;
  material_label: string;
  animal_species: string | null;
  leather_type: string | null;
  grain_structure: string | null;
  surface_finish: string | null;
  tannage: string | null;
  substrate_fiber: string | null;
  coating_polymer: string | null;
  material_origin_country: string | null;
  attribute_state: AttributeState;
};

type ProductRecord = {
  product_id: string;
  style_number: string;
  name: string;
  family: string | null;
  collection_or_season: string | null;
  market: string;
  pattern_family: string | null;
  silhouette: string;
  components: ProductComponent[];
  construction_features?: string[];
  product_made_in: string | null;
  observed_at: string;
  source_ids: string[];
  evidence: EvidenceRecord[];
  confidence: string;
  notes: string;
};

type WikiSnapshot = {
  knowledge_base_version: string;
  retrieval_corpus_sha256: string;
  counts: { sources: number; claims: number; products: number };
  sources: SourceRecord[];
  claims: ClaimRecord[];
  products: ProductRecord[];
};

type RankedRecord =
  | { kind: 'claim'; record: ClaimRecord; score: number }
  | { kind: 'product'; record: ProductRecord; score: number };

type SourceCitation = {
  sourceId: string;
  publisher: string;
  title: string;
  url: string;
  sourceClass: string;
  authorityGrade: string;
  publishedAt: string | null;
  datePrecision: string;
  observedAt: string;
  locator: string;
  support: EvidenceRecord['support'];
};

type WikiClaimEntry = {
  kind: 'claim';
  recordId: string;
  topic: string;
  subject: string;
  statementKo: string;
  factScope: string;
  claimOwner: string;
  evidenceMode: string;
  aiUse: ClaimRecord['ai_use'];
  confidence: string;
  validTime: TimeContext;
  observedAt: string;
  sources: SourceCitation[];
  notes: string;
  useBoundary: string;
};

type WikiConflictEntry = {
  kind: 'conflict_set';
  conflictGroupId: string;
  members: WikiClaimEntry[];
  useBoundary: string;
};

type WikiProductEntry = {
  kind: 'product_example';
  recordId: string;
  styleNumber: string;
  name: string;
  family: string | null;
  collectionOrSeason: string | null;
  market: string;
  patternFamily: string | null;
  silhouette: string;
  components: Array<{
    role: string;
    materialClass: string;
    materialLabel: string;
    attributes: Record<
      string,
      { value: string | null; state: 'reported' | 'unknown' | 'not_applicable' }
    >;
  }>;
  constructionFeatures: string[];
  productMadeIn: string | null;
  observedAt: string;
  sources: SourceCitation[];
  notes: string;
  useBoundary: string;
};

export type McmLeatherWikiEntry =
  | WikiClaimEntry
  | WikiConflictEntry
  | WikiProductEntry;

export type McmLeatherWikiSearchResult = {
  knowledgeBaseVersion: string;
  retrieverVersion: string;
  retrievalCorpusSha256: string;
  queryHash: string;
  entries: McmLeatherWikiEntry[];
  recordIds: string[];
  sourceIds: string[];
  notices: string[];
  truncated: boolean;
};

const wikiSnapshot = wikiSnapshotJson as unknown as WikiSnapshot;
const sourceById = new Map(
  wikiSnapshot.sources.map((source) => [source.source_id, source]),
);
const claimsByConflictGroup = new Map<string, ClaimRecord[]>();
for (const claim of wikiSnapshot.claims) {
  if (!claim.conflict_group_id) continue;
  const group = claimsByConflictGroup.get(claim.conflict_group_id) ?? [];
  group.push(claim);
  claimsByConflictGroup.set(claim.conflict_group_id, group);
}

export const MCM_LEATHER_WIKI_RETRIEVER_VERSION =
  'MCM_LEATHER_WIKI_LEXICAL_V1';
export const MCM_LEATHER_WIKI_CORPUS_VERSION =
  wikiSnapshot.knowledge_base_version;
export const MCM_LEATHER_WIKI_VERSION = `${MCM_LEATHER_WIKI_CORPUS_VERSION}:${MCM_LEATHER_WIKI_RETRIEVER_VERSION}:${wikiSnapshot.retrieval_corpus_sha256.slice(0, 16)}`;

const MAX_ENTRIES = 6;
const MAX_RANKED_CANDIDATES = 24;
const MAX_TOOL_RESULT_CHARS = 8_000;
const MAX_SOURCE_CITATIONS = 3;

const TERM_GROUPS = [
  ['visetos', '비세토스', 'monogram canvas', '모노그램 캔버스'],
  ['lauretos', '라우레토스', 'laurel monogram', '월계수 모노그램'],
  ['laurel', '월계수'],
  ['diamond', 'diamant', '다이아몬드', '마름모', 'bavarian diamond'],
  ['coated canvas', '코팅 캔버스'],
  ['nappa', 'napa', '나파'],
  ['calf', 'calfskin', '송아지'],
  ['lamb', 'lambskin', '양가죽'],
  ['goat', 'goatskin', '염소가죽'],
  ['suede', '스웨이드'],
  ['patent', '페이턴트'],
  ['embossed', 'embossing', '엠보싱'],
  ['quilted', 'quilting', '퀼팅'],
  ['jacquard', '자카드'],
  ['perforated', 'perforation', '천공'],
  ['croco', 'crocodile', '악어'],
  ['vachetta', '바케타'],
  ['resetos', 'regenerated leather', '재생가죽', '재생 가죽'],
  ['lwg', 'leather working group'],
] as const;

const ATTRIBUTE_KEYS = [
  'animal_species',
  'leather_type',
  'grain_structure',
  'surface_finish',
  'tannage',
  'substrate_fiber',
  'coating_polymer',
  'material_origin_country',
] as const;

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function sanitizeLookup(input: McmLeatherWikiLookup): McmLeatherWikiLookup {
  const terms = input.terms
    .map((term) =>
      normalize(term)
        .split(' ')
        .filter(
          (token) =>
            !(
              token.length >= 8 &&
              token.length <= 24 &&
              /^[a-z0-9]+$/i.test(token) &&
              /[a-z]/i.test(token) &&
              /[0-9]/.test(token)
            ),
        )
        .join(' '),
    )
    .filter((term) => term.length >= 2);

  return {
    terms: terms.length > 0 ? terms : ['redactedlookup'],
    topics: input.topics,
    includeProductExamples: input.includeProductExamples,
  };
}

function normalizedSearchTerms(terms: string[]): string[] {
  const original = new Set(terms.map(normalize).filter(Boolean));
  const expanded = new Set(original);
  for (const term of original) {
    for (const group of TERM_GROUPS) {
      if (group.some((candidate) => term.includes(normalize(candidate)))) {
        for (const candidate of group) expanded.add(normalize(candidate));
      }
    }
  }
  return [...expanded].sort();
}

function claimSearchText(claim: ClaimRecord): { title: string; body: string } {
  return {
    title: normalize(`${claim.subject} ${claim.topic}`),
    body: normalize(
      `${claim.claim_ko} ${claim.notes} ${claim.fact_scope} ${claim.claim_owner}`,
    ),
  };
}

function productSearchText(product: ProductRecord): {
  title: string;
  body: string;
} {
  return {
    title: normalize(
      `${product.style_number} ${product.name} ${product.family ?? ''} ${product.pattern_family ?? ''}`,
    ),
    body: normalize(
      [
        product.collection_or_season ?? '',
        product.silhouette,
        ...product.components.flatMap((component) => [
          component.role,
          component.material_class,
          component.material_label,
          component.animal_species ?? '',
          component.leather_type ?? '',
          component.grain_structure ?? '',
          component.surface_finish ?? '',
          component.tannage ?? '',
          component.substrate_fiber ?? '',
          component.coating_polymer ?? '',
        ]),
        ...(product.construction_features ?? []),
        product.notes,
      ].join(' '),
    ),
  };
}

function lexicalScore(
  searchTerms: string[],
  originalTerms: Set<string>,
  title: string,
  body: string,
): number {
  let score = 0;
  for (const term of searchTerms) {
    const weight = originalTerms.has(term) ? 2 : 1;
    if (title.includes(term)) score += 28 * weight;
    if (body.includes(term)) score += 10 * weight;
    for (const token of term.split(' ').filter((part) => part.length >= 2)) {
      if (title.includes(token)) score += 6 * weight;
      if (body.includes(token)) score += 2 * weight;
    }
  }
  return score;
}

function rankRecords(input: McmLeatherWikiLookup): RankedRecord[] {
  const originalTerms = new Set(input.terms.map(normalize).filter(Boolean));
  const searchTerms = normalizedSearchTerms(input.terms);
  const selectedTopics = new Set(input.topics);
  const ranked: RankedRecord[] = [];

  for (const claim of wikiSnapshot.claims) {
    if (claim.ai_use === 'exclude') continue;
    const text = claimSearchText(claim);
    let score = lexicalScore(searchTerms, originalTerms, text.title, text.body);
    const topicMatched = selectedTopics.has(claim.topic);
    if (topicMatched) score += 18;
    if (score <= 0) continue;
    if (claim.ai_use === 'negative_constraint') score += 20;
    if (claim.ai_use === 'grounding') score += 10;
    if (claim.ai_use === 'context_only') score -= 6;
    if (claim.evidence_mode === 'unknown') score += 8;
    ranked.push({ kind: 'claim', record: claim, score });
  }

  if (input.includeProductExamples) {
    for (const product of wikiSnapshot.products) {
      const text = productSearchText(product);
      const score = lexicalScore(
        searchTerms,
        originalTerms,
        text.title,
        text.body,
      );
      if (score > 0) ranked.push({ kind: 'product', record: product, score });
    }
  }

  return ranked.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    const leftId =
      left.kind === 'claim' ? left.record.claim_id : left.record.product_id;
    const rightId =
      right.kind === 'claim' ? right.record.claim_id : right.record.product_id;
    return leftId.localeCompare(rightId);
  });
}

function clip(value: string, maxLength: number): string {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function citationsForEvidence(evidence: EvidenceRecord[]): SourceCitation[] {
  return evidence.slice(0, MAX_SOURCE_CITATIONS).flatMap((item) => {
    const source = sourceById.get(item.source_id);
    if (!source) return [];
    return [
      {
        sourceId: source.source_id,
        publisher: clip(source.publisher, 80),
        title: clip(source.title, 140),
        url: source.url,
        sourceClass: source.source_class,
        authorityGrade: source.authority_grade,
        publishedAt: source.published_at,
        datePrecision: source.date_precision,
        observedAt: source.observed_at,
        locator: clip(item.locator, 180),
        support: item.support,
      },
    ];
  });
}

function claimUseBoundary(claim: ClaimRecord): string {
  if (claim.ai_use === 'negative_constraint' || claim.evidence_mode === 'unknown') {
    return '미확인·금지 경계다. 더 구체적인 제품 속성으로 승격하지 않는다.';
  }
  if (claim.fact_scope === 'industry_general') {
    return '업계 일반 지식이며 특정 MCM 제품에 적용됐다는 증거가 아니다.';
  }
  if (claim.fact_scope === 'mcm_product') {
    return '명시된 제품·스냅샷에만 적용하며 다른 SKU나 제출 사진에 자동 전파하지 않는다.';
  }
  if (claim.ai_use === 'context_only') {
    return '배경 문맥 전용이며 사진 분류나 진위 판단의 직접 근거로 쓰지 않는다.';
  }
  return '사진에서 독립적으로 관찰되는 증거가 있을 때만 용어·해석 보조로 사용한다.';
}

function toClaimEntry(claim: ClaimRecord): WikiClaimEntry {
  return {
    kind: 'claim',
    recordId: claim.claim_id,
    topic: claim.topic,
    subject: clip(claim.subject, 120),
    statementKo: clip(claim.claim_ko, 420),
    factScope: claim.fact_scope,
    claimOwner: clip(claim.claim_owner, 80),
    evidenceMode: claim.evidence_mode,
    aiUse: claim.ai_use,
    confidence: claim.confidence,
    validTime: claim.valid_time,
    observedAt: claim.observed_at,
    sources: citationsForEvidence(claim.evidence),
    notes: clip(claim.notes, 260),
    useBoundary: claimUseBoundary(claim),
  };
}

function toProductEntry(product: ProductRecord): WikiProductEntry {
  return {
    kind: 'product_example',
    recordId: product.product_id,
    styleNumber: product.style_number,
    name: clip(product.name, 160),
    family: product.family,
    collectionOrSeason: product.collection_or_season,
    market: product.market,
    patternFamily: product.pattern_family,
    silhouette: clip(product.silhouette, 140),
    components: product.components.map((component) => ({
      role: component.role,
      materialClass: component.material_class,
      materialLabel: clip(component.material_label, 180),
      attributes: Object.fromEntries(
        ATTRIBUTE_KEYS.map((key) => [
          key,
          {
            value: component[key],
            state: component.attribute_state[key],
          },
        ]),
      ),
    })),
    constructionFeatures: (product.construction_features ?? []).map((feature) =>
      clip(feature, 160),
    ),
    productMadeIn: product.product_made_in,
    observedAt: product.observed_at,
    sources: citationsForEvidence(product.evidence),
    notes: clip(product.notes, 260),
    useBoundary:
      '공식 SKU 예시일 뿐이다. 정확한 style number 근거가 없으면 제출 사진의 제품·소재·생산국으로 동일시하지 않는다.',
  };
}

function entryRecordIds(entry: McmLeatherWikiEntry): string[] {
  if (entry.kind === 'conflict_set') {
    return entry.members.map((member) => member.recordId);
  }
  return [entry.recordId];
}

function entrySourceIds(entry: McmLeatherWikiEntry): string[] {
  if (entry.kind === 'conflict_set') {
    return entry.members.flatMap((member) =>
      member.sources.map((source) => source.sourceId),
    );
  }
  return entry.sources.map((source) => source.sourceId);
}

function buildEntries(ranked: RankedRecord[]): McmLeatherWikiEntry[] {
  const entries: McmLeatherWikiEntry[] = [];
  const consumedRecordIds = new Set<string>();

  for (const candidate of ranked) {
    if (entries.length >= MAX_RANKED_CANDIDATES) break;
    if (candidate.kind === 'product') {
      if (consumedRecordIds.has(candidate.record.product_id)) continue;
      consumedRecordIds.add(candidate.record.product_id);
      entries.push(toProductEntry(candidate.record));
      continue;
    }

    const claim = candidate.record;
    if (consumedRecordIds.has(claim.claim_id)) continue;
    if (!claim.conflict_group_id) {
      consumedRecordIds.add(claim.claim_id);
      entries.push(toClaimEntry(claim));
      continue;
    }

    const members = (claimsByConflictGroup.get(claim.conflict_group_id) ?? [claim])
      .filter((member) => member.ai_use !== 'exclude')
      .sort((left, right) => left.claim_id.localeCompare(right.claim_id));
    for (const member of members) consumedRecordIds.add(member.claim_id);
    entries.push({
      kind: 'conflict_set',
      conflictGroupId: claim.conflict_group_id,
      members: members.map(toClaimEntry),
      useBoundary:
        '상충하는 기록을 한 묶음으로 유지한다. 사진만으로 어느 서술이 참인지 선택하거나 합성하지 않는다.',
    });
  }

  return entries;
}

function canonicalLookup(input: McmLeatherWikiLookup): string {
  return JSON.stringify({
    terms: [...new Set(input.terms.map(normalize).filter(Boolean))].sort(),
    topics: [...new Set(input.topics)].sort(),
    includeProductExamples: input.includeProductExamples,
  });
}

function toolPayload(
  queryHash: string,
  entries: McmLeatherWikiEntry[],
  truncated: boolean,
): McmLeatherWikiSearchResult {
  const recordIds = [...new Set(entries.flatMap(entryRecordIds))].sort();
  const sourceIds = [...new Set(entries.flatMap(entrySourceIds))].sort();
  return {
    knowledgeBaseVersion: MCM_LEATHER_WIKI_CORPUS_VERSION,
    retrieverVersion: MCM_LEATHER_WIKI_RETRIEVER_VERSION,
    retrievalCorpusSha256: wikiSnapshot.retrieval_corpus_sha256,
    queryHash,
    entries,
    recordIds,
    sourceIds,
    notices: [
      '위키 결과는 참고 자료이며 제출된 여섯 사진의 시각 증거가 아니다.',
      '제품 예시는 정확한 SKU 일치 증거가 아니며 정품·제조연도·숨은 소재를 입증하지 않는다.',
      'factScope, evidenceMode, aiUse, validTime, attribute state와 충돌 묶음을 유지한다.',
      '공식 이미지 레지스트리는 권리 상태가 reference-only이므로 외부 분석 입력이나 비교 자료로 보내지 않았다.',
    ],
    truncated,
  };
}

export function searchMcmLeatherWiki(
  rawInput: McmLeatherWikiLookup,
): McmLeatherWikiSearchResult {
  const input = sanitizeLookup(McmLeatherWikiLookupSchema.parse(rawInput));
  const queryHash = createHash('sha256')
    .update(canonicalLookup(input))
    .digest('hex');
  const ranked = rankRecords(input);
  const candidates = buildEntries(ranked);
  const selected: McmLeatherWikiEntry[] = [];
  let truncated = ranked.length > candidates.length;

  for (const entry of candidates) {
    if (selected.length >= MAX_ENTRIES) {
      truncated = true;
      break;
    }
    const next = [...selected, entry];
    if (JSON.stringify(toolPayload(queryHash, next, truncated)).length > MAX_TOOL_RESULT_CHARS) {
      truncated = true;
      continue;
    }
    selected.push(entry);
  }

  return toolPayload(queryHash, selected, truncated);
}

export function formatMcmLeatherWikiToolResult(
  result: McmLeatherWikiSearchResult,
): string {
  return JSON.stringify(result);
}

export function mcmLeatherWikiContextSha256(context: string): string {
  return createHash('sha256').update(context).digest('hex');
}
