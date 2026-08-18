import { NextRequest, NextResponse } from 'next/server';
import { authenticate, requireRole } from '@/server/auth/middleware';
import { handleApiError } from '@/server/auth/errorHandler';
import { createAnalysis } from '@/server/analyses/analysisService';
import { ValidationError } from '@/contracts/errors';
import { SourceCategorySchema } from '@/contracts/analysis';
import { z } from 'zod';

const CreateAnalysisRequestSchema = z.object({
  imageAssetIds: z.array(z.string().uuid()).min(1).max(4),
  sourceCategoryHint: SourceCategorySchema.nullable().optional(),
  locale: z.enum(['ko-KR']),
  demoScenarioKey: z
    .enum(['TOTE_MODERATE_WEAR', 'BACKPACK_LIGHT_WEAR', 'CROSSBODY_HEAVY_WEAR', 'LOW_QUALITY_RECAPTURE'])
    .nullable()
    .optional(),
});

/**
 * POST /api/v1/analyses
 * 원제품 이미지 분석 실행
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    requireRole(user, ['CUSTOMER']);

    // Get idempotency key
    const idempotencyKey = request.headers.get('idempotency-key');
    if (!idempotencyKey) {
      throw new ValidationError('Idempotency-Key header is required');
    }

    const body = await request.json();
    const validated = CreateAnalysisRequestSchema.parse(body);

    const analysis = await createAnalysis({
      customerId: user.id,
      ...validated,
    });

    return NextResponse.json(analysis, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(
        new ValidationError('Invalid request body', { zodErrors: error.issues })
      );
    }
    return handleApiError(error);
  }
}

/**
 * GET /api/v1/analyses
 * 내 분석 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    requireRole(user, ['CUSTOMER']);

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') ?? '0');
    const size = Math.min(parseInt(url.searchParams.get('size') ?? '20'), 100);

    // Fetch analyses for customer
    const { data, error, count } = await (await import('@/lib/supabase/server')).supabaseAdmin
      .from('analyses')
      .select('id, source_category, condition_grade, reusable_rate, mode_used, created_at', {
        count: 'exact',
      })
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
      .range(page * size, (page + 1) * size - 1);

    if (error) {
      throw new Error(`Failed to fetch analyses: ${error.message}`);
    }

    const totalElements = count ?? 0;
    const totalPages = Math.ceil(totalElements / size);

    return NextResponse.json({
      items: data?.map((a) => ({
        id: a.id,
        sourceCategory: a.source_category,
        conditionGrade: a.condition_grade,
        reusableMaterialRate: a.reusable_rate,
        modeUsed: a.mode_used,
        createdAt: a.created_at,
      })) ?? [],
      page,
      size,
      totalElements,
      totalPages,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
