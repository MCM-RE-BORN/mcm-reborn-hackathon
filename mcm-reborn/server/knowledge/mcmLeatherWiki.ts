import 'server-only';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import wikiSnapshotJson from './mcmLeatherWiki.generated.json';

const ClaimTopicSchema = z.enum([
  'pattern',
  'design',
  'material',
  'leather_type',
  'construction',
  'process',
  'unknown',
]);

export const McmLeatherWikiLookupSchema = z
  .object({
    terms: z.array(z.string().trim().min(2).max(60)).min(1).max(8),
    topics: z.array(ClaimTopicSchema).max(4),
    // Product examples are intentionally absent from the runtime corpus. Keep
    // the field for a stable tool contract, but make any other value invalid.
    includeProductExamples: z.literal(false),
  })
  .strict();

export type McmLeatherWikiLookup = z.infer<
  typeof McmLeatherWikiLookupSchema
>;

const EvidenceSchema = z
  .object({
    source_id: z.string().min(1),
    locator: z.string(),
    support: z.enum(['supports', 'contradicts', 'context_only']),
  })
  .strict();

const TimeContextSchema = z
  .object({
    label: z.string(),
    start: z.string().nullable(),
    end: z.string().nullable(),
    precision: z.string(),
    status: z.string(),
  })
  .strict();

const SourceRecordSchema = z
  .object({
    source_id: z.string().min(1),
    publisher: z.string(),
    title: z.string(),
    url: z.string(),
    source_class: z.string(),
    authority_grade: z.string(),
    published_at: z.string().nullable(),
    observed_at: z.string(),
  })
  .strict();

const ClaimRecordSchema = z
  .object({
    claim_id: z.string().min(1),
    runtime_role: z.enum(['dynamic', 'always_on_safety']),
    topic: ClaimTopicSchema.exclude(['unknown']),
    subject: z.string().min(1),
    prompt_safe_text: z.string().min(1),
    prompt_safe_override: z.boolean(),
    authored_text_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    fact_scope: z.string().min(1),
    claim_owner: z.string().min(1),
    evidence_mode: z.enum(['direct', 'derived', 'unknown']),
    ai_use: z.enum(['grounding', 'negative_constraint']),
    confidence: z.enum(['high', 'medium']),
    valid_time: TimeContextSchema,
    observed_at: z.string(),
    evidence: z.array(EvidenceSchema).min(1),
  })
  .strict();

const WikiSnapshotSchema = z
  .object({
    record_type: z.literal('mcm_leather_wiki_runtime_snapshot'),
    knowledge_base_version: z.string().min(1),
    full_corpus_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    retrieval_corpus_sha256: z.string().regex(/^[a-f0-9]{64}$/),
    source_files: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)),
    ordered_claim_ids: z.array(z.string()).length(18),
    dynamic_claim_ids: z.array(z.string()).length(11),
    always_on_safety_claim_ids: z.array(z.string()).length(7),
    counts: z
      .object({
        authored_sources: z.number().int().nonnegative(),
        authored_claims: z.number().int().nonnegative(),
        authored_products: z.number().int().nonnegative(),
        runtime_sources: z.number().int().nonnegative(),
        runtime_claims: z.literal(18),
      })
      .strict(),
    sources: z.array(SourceRecordSchema),
    claims: z.array(ClaimRecordSchema).length(18),
  })
  .strict();

type ClaimRecord = z.infer<typeof ClaimRecordSchema>;
type EvidenceRecord = z.infer<typeof EvidenceSchema>;

type SourceCitation = {
  sourceId: string;
  publisher: string;
  authorityGrade: string;
  sourceClass: string;
  locator: string;
  support: EvidenceRecord['support'];
};

export type McmLeatherWikiEntry = {
  kind: 'claim';
  recordId: string;
  topic: string;
  subject: string;
  statementKo: string;
  factScope: string;
  evidenceMode: ClaimRecord['evidence_mode'];
  confidence: ClaimRecord['confidence'];
  validTime: z.infer<typeof TimeContextSchema>;
  observedAt: string;
  sources: SourceCitation[];
  useBoundary: string;
};

export type McmLeatherWikiSearchResult = {
  knowledgeBaseVersion: string;
  retrieverVersion: string;
  fullCorpusSha256: string;
  retrievalCorpusSha256: string;
  orderedClaimIds: readonly string[];
  alwaysOnSafetyClaimIds: readonly string[];
  queryHash: string;
  entries: McmLeatherWikiEntry[];
  recordIds: string[];
  sourceIds: string[];
  notices: string[];
  truncated: boolean;
};

type RankedClaim = { record: ClaimRecord; score: number };

const wikiSnapshot = WikiSnapshotSchema.parse(wikiSnapshotJson);
const sourceById = new Map(
  wikiSnapshot.sources.map((source) => [source.source_id, source]),
);
const claimById = new Map(
  wikiSnapshot.claims.map((claim) => [claim.claim_id, claim]),
);

export const MCM_LEATHER_WIKI_RETRIEVER_VERSION =
  'MCM_LEATHER_WIKI_LEXICAL_V2_CURATED';
export const MCM_LEATHER_WIKI_CORPUS_VERSION =
  wikiSnapshot.knowledge_base_version;
export const MCM_LEATHER_WIKI_FULL_CORPUS_SHA256 =
  wikiSnapshot.full_corpus_sha256;
export const MCM_LEATHER_WIKI_RETRIEVAL_CORPUS_SHA256 =
  wikiSnapshot.retrieval_corpus_sha256;
export const MCM_LEATHER_WIKI_ORDERED_CLAIM_IDS = Object.freeze([
  ...wikiSnapshot.ordered_claim_ids,
]);
export const MCM_LEATHER_WIKI_DYNAMIC_CLAIM_IDS = Object.freeze([
  ...wikiSnapshot.dynamic_claim_ids,
]);
export const MCM_LEATHER_WIKI_ALWAYS_ON_SAFETY_CLAIM_IDS = Object.freeze([
  ...wikiSnapshot.always_on_safety_claim_ids,
]);
export const MCM_LEATHER_WIKI_VERSION =
  `${MCM_LEATHER_WIKI_CORPUS_VERSION}:${MCM_LEATHER_WIKI_RETRIEVER_VERSION}:${MCM_LEATHER_WIKI_RETRIEVAL_CORPUS_SHA256.slice(0, 16)}`;

const safetyClaims = MCM_LEATHER_WIKI_ALWAYS_ON_SAFETY_CLAIM_IDS.map(
  (claimId) => {
    const claim = claimById.get(claimId);
    if (!claim || claim.runtime_role !== 'always_on_safety') {
      throw new Error(`MCM_RUNTIME_SAFETY_CLAIM_MISSING:${claimId}`);
    }
    return claim;
  },
);

/** Mandatory negative constraints appended to every final analysis prompt. */
export const MCM_LEATHER_WIKI_ALWAYS_ON_SAFETY_CONTEXT = [
  'MCM mandatory safety constraints. These rules always apply, even when wiki lookup fails or returns no entries:',
  ...safetyClaims.map(
    (claim) =>
      `- [${claim.claim_id}] ${claim.prompt_safe_text} (scope=${claim.fact_scope}; evidence=${claim.evidence_mode}; confidence=${claim.confidence})`,
  ),
].join('\n');

const MAX_ENTRIES = 5;
const MAX_RANKED_CANDIDATES = 18;
const MAX_TOOL_RESULT_CHARS = 4_000;
const MAX_SOURCE_CITATIONS = 2;

const TERM_GROUPS = [
  ['visetos', '비세토스', 'monogram canvas', '모노그램 캔버스'],
  ['maxi visetos', 'maxi monogram', '맥시 비세토스', '확대 모노그램'],
  ['lauretos', '라우레토스', 'laurel monogram', '월계수 모노그램'],
  ['cubic monogram', '큐빅 모노그램', '3d monogram', '입체 모노그램'],
  ['vintage monogram', '빈티지 모노그램'],
  ['laurel', '월계수'],
  ['diamond', 'diamant', '다이아몬드', '마름모', 'bavarian diamond'],
  ['coated canvas', '코팅 캔버스'],
  ['canvas', '캔버스'],
  ['nappa', 'napa', '나파'],
  ['full grain', 'full grain leather', 'full-grain', '풀 그레인'],
  ['calf', 'calfskin', '송아지'],
  ['lamb', 'lambskin', '양가죽'],
  ['goat', 'goatskin', '염소가죽'],
  ['leather', '가죽'],
  ['textile', '직물', '섬유'],
  ['microfiber', '마이크로화이버'],
  ['printed', 'print', '인쇄', '프린트'],
  ['embossed', 'embossing', '엠보싱'],
  ['quilted', 'quilting', '퀼팅'],
  ['jacquard', 'woven', '자카드', '직조'],
  ['studded', 'stud', '스터드'],
  ['croco embossed', 'croco', '악어무늬', '크로코 엠보싱'],
  ['crushed', 'distressed', '크러시드', '디스트레스드'],
  ['hardware', 'metal', '하드웨어', '금속'],
] as const;

const GENERIC_QUERY_TOKENS = new Set([
  'bag',
  'product',
  'material',
  'surface',
  'pattern',
  '가방',
  '제품',
  '소재',
  '표면',
  '패턴',
]);

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function hasExactPhrase(haystack: string, phrase: string): boolean {
  if (!haystack || !phrase) return false;
  return ` ${haystack} `.includes(` ${phrase} `);
}

function lookupAtoms(terms: string[]): {
  atoms: string[];
  originalAtoms: Set<string>;
} {
  const originalAtoms = new Set<string>();
  for (const rawTerm of terms) {
    const term = normalize(rawTerm);
    if (!term) continue;
    if (!GENERIC_QUERY_TOKENS.has(term)) {
      originalAtoms.add(term);
    }
    for (const token of term.split(' ')) {
      if (token.length >= 2 && !GENERIC_QUERY_TOKENS.has(token)) {
        originalAtoms.add(token);
      }
    }
  }

  const expanded = new Set(originalAtoms);
  for (const term of originalAtoms) {
    for (const group of TERM_GROUPS) {
      if (
        group.some((candidate) =>
          hasExactPhrase(term, normalize(candidate)),
        )
      ) {
        for (const candidate of group) expanded.add(normalize(candidate));
      }
    }
  }
  return { atoms: [...expanded].sort(), originalAtoms };
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
    topics: [...new Set(input.topics)],
    includeProductExamples: false,
  };
}

function claimSearchText(claim: ClaimRecord): {
  title: string;
  body: string;
} {
  return {
    title: normalize(`${claim.subject} ${claim.topic}`),
    body: normalize(
      `${claim.prompt_safe_text} ${claim.fact_scope} ${claim.claim_owner}`,
    ),
  };
}

function lexicalScore(
  searchAtoms: string[],
  originalAtoms: Set<string>,
  title: string,
  body: string,
): number {
  let score = 0;
  for (const atom of searchAtoms) {
    const weight = originalAtoms.has(atom) ? 2 : 1;
    if (hasExactPhrase(title, atom)) score += 28 * weight;
    if (hasExactPhrase(body, atom)) score += 10 * weight;
  }
  return score;
}

function rankRecords(input: McmLeatherWikiLookup): RankedClaim[] {
  const { atoms, originalAtoms } = lookupAtoms(input.terms);
  const selectedTopics = new Set(input.topics);
  const ranked: RankedClaim[] = [];

  for (const claim of wikiSnapshot.claims) {
    if (claim.runtime_role !== 'dynamic') continue;
    const text = claimSearchText(claim);
    const lexical = lexicalScore(atoms, originalAtoms, text.title, text.body);
    // A topic is a ranking hint only. It must never admit a claim without an
    // exact lexical token or phrase hit.
    if (lexical <= 0) continue;
    let score = lexical;
    if (selectedTopics.has(claim.topic)) score += 12;
    if (claim.confidence === 'high') score += 4;
    score += claim.evidence_mode === 'direct' ? 4 : 2;
    ranked.push({ record: claim, score });
  }

  return ranked.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return left.record.claim_id.localeCompare(right.record.claim_id);
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
        publisher: clip(source.publisher, 60),
        authorityGrade: source.authority_grade,
        sourceClass: source.source_class,
        locator: clip(item.locator, 110),
        support: item.support,
      },
    ];
  });
}

function claimUseBoundary(claim: ClaimRecord): string {
  if (claim.fact_scope === 'industry_general') {
    return '업계 일반 용어이며 제출 제품에 적용됐다는 증거가 아니다.';
  }
  if (claim.fact_scope === 'mcm_product') {
    return '특정 공식 제품 근거를 다른 SKU나 제출 사진에 자동 전파하지 않는다.';
  }
  return '사진에서 독립적으로 관찰되는 단서가 있을 때만 용어 보조로 사용한다.';
}

function toClaimEntry(claim: ClaimRecord): McmLeatherWikiEntry {
  return {
    kind: 'claim',
    recordId: claim.claim_id,
    topic: claim.topic,
    subject: clip(claim.subject, 90),
    statementKo: clip(claim.prompt_safe_text, 340),
    factScope: claim.fact_scope,
    evidenceMode: claim.evidence_mode,
    confidence: claim.confidence,
    validTime: claim.valid_time,
    observedAt: claim.observed_at,
    sources: citationsForEvidence(claim.evidence),
    useBoundary: claimUseBoundary(claim),
  };
}

function canonicalLookup(input: McmLeatherWikiLookup): string {
  return JSON.stringify({
    terms: [...new Set(input.terms.map(normalize).filter(Boolean))].sort(),
    topics: [...new Set(input.topics)].sort(),
    includeProductExamples: false,
  });
}

function toolPayload(
  queryHash: string,
  entries: McmLeatherWikiEntry[],
  truncated: boolean,
): McmLeatherWikiSearchResult {
  // Preserve retrieval rank so the exact model context can be audited.
  const recordIds = entries.map((entry) => entry.recordId);
  const sourceIds = [
    ...new Set(
      entries.flatMap((entry) =>
        entry.sources.map((source) => source.sourceId),
      ),
    ),
  ].sort();
  return {
    knowledgeBaseVersion: MCM_LEATHER_WIKI_CORPUS_VERSION,
    retrieverVersion: MCM_LEATHER_WIKI_RETRIEVER_VERSION,
    fullCorpusSha256: MCM_LEATHER_WIKI_FULL_CORPUS_SHA256,
    retrievalCorpusSha256: MCM_LEATHER_WIKI_RETRIEVAL_CORPUS_SHA256,
    orderedClaimIds: MCM_LEATHER_WIKI_ORDERED_CLAIM_IDS,
    alwaysOnSafetyClaimIds: MCM_LEATHER_WIKI_ALWAYS_ON_SAFETY_CLAIM_IDS,
    queryHash,
    entries,
    recordIds,
    sourceIds,
    notices: [
      '결과는 용어 참고 자료이며 제출 사진의 증거가 아니다.',
      '제품·SKU 예시는 런타임 코퍼스에 포함되지 않는다.',
      '항상 적용되는 safety claim은 별도 developer context로 제공된다.',
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
  const selected: McmLeatherWikiEntry[] = [];
  let truncated = false;

  for (const candidate of ranked.slice(0, MAX_RANKED_CANDIDATES)) {
    if (selected.length >= MAX_ENTRIES) {
      truncated = true;
      break;
    }
    const next = [...selected, toClaimEntry(candidate.record)];
    if (modelContextJson(toolPayload(queryHash, next, true)).length >
      MAX_TOOL_RESULT_CHARS) {
      truncated = true;
      continue;
    }
    selected.push(next[next.length - 1]);
  }
  if (ranked.length > selected.length) truncated = true;

  return toolPayload(queryHash, selected, truncated);
}

export function formatMcmLeatherWikiToolResult(
  result: McmLeatherWikiSearchResult,
): string {
  const context = modelContextJson(result);
  if (context.length > MAX_TOOL_RESULT_CHARS) {
    throw new Error('MCM_WIKI_CONTEXT_EXCEEDS_LIMIT');
  }
  return context;
}

export function mcmLeatherWikiContextSha256(context: string): string {
  return createHash('sha256').update(context).digest('hex');
}

function modelContextJson(result: McmLeatherWikiSearchResult): string {
  return JSON.stringify({
    entries: result.entries,
    knowledgeBaseVersion: result.knowledgeBaseVersion,
    notices: result.notices,
    queryHash: result.queryHash,
    retrievalCorpusSha256: result.retrievalCorpusSha256,
    retrieverVersion: result.retrieverVersion,
    truncated: result.truncated,
  });
}
