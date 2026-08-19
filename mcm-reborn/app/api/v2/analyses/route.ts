import { NextResponse } from 'next/server';
import { z } from 'zod';
import { SourceCategorySchema } from '@/contracts/analysis';
import { ValidationError } from '@/contracts/errors';
import {
  createAnalysis,
  listMyAnalyses,
} from '@/server/analyses/analysisService';
import { handleApiError } from '@/server/auth/errorHandler';
import { authenticate, requireRole } from '@/server/auth/middleware';
import { readJsonBody } from '@/server/http/json';

export const runtime = 'nodejs';

const CreateAnalysisRequestSchema = z.object({
  imageAssetIds: z.array(z.string().uuid()).length(7).refine(
    (ids) => new Set(ids).size === ids.length,
    'imageAssetIds must be unique',
  ),
  category: SourceCategorySchema,
  purchaseYear: z.number().int().min(1976).max(2100),
  useDuration: z.string().trim().min(1).max(80),
  desiredUse: z.string().trim().min(1).max(200),
  serialNumber: z.string().trim().min(1).max(100).optional(),
  conditionNote: z.string().trim().max(500).optional(),
  locale: z.literal('ko-KR'),
  demoScenarioKey: z
    .enum([
      'MCM_BACKPACK_CHANGE_APPROVED_20260817',
      'LOW_QUALITY_RECAPTURE',
      'INELIGIBLE_PRECHECK',
    ])
    .nullable()
    .optional(),
  externalAiProcessingConsentAccepted: z.literal(true).optional(),
  externalAiPrivacyNoticeVersion: z.string().trim().min(1).max(100).optional(),
}).strict();

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(100).default(20),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const user = await authenticate(request);
    requireRole(user, ['CUSTOMER']);
    const idempotencyKey = readIdempotencyKey(request);
    const body = await readJsonBody(request);
    const input = CreateAnalysisRequestSchema.parse(body);
    const analysis = await createAnalysis({
      ...input,
      accessToken: user.accessToken,
      customerId: user.id,
      idempotencyKey,
    });

    return NextResponse.json(analysis, {
      headers: { 'Cache-Control': 'no-store' },
      status: 201,
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await authenticate(request);
    requireRole(user, ['CUSTOMER']);
    const url = new URL(request.url);
    const pagination = PaginationSchema.parse({
      page: url.searchParams.get('page') ?? undefined,
      size: url.searchParams.get('size') ?? undefined,
    });
    const analyses = await listMyAnalyses(
      user,
      pagination.page,
      pagination.size,
    );

    return NextResponse.json(analyses, {
      headers: { 'Cache-Control': 'no-store' },
      status: 200,
    });
  } catch (error) {
    return routeError(error);
  }
}

function readIdempotencyKey(request: Request): string {
  const key = request.headers.get('idempotency-key')?.trim();
  if (!key || key.length < 8 || key.length > 128) {
    throw new ValidationError(
      'Idempotency-Key must be between 8 and 128 characters',
      { field: 'Idempotency-Key' },
    );
  }
  return key;
}

function routeError(error: unknown): Response {
  if (error instanceof z.ZodError) {
    return handleApiError(
      new ValidationError('Invalid request', { issues: error.issues }),
    );
  }
  return handleApiError(error);
}
