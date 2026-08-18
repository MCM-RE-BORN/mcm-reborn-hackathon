import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/server/auth/middleware';
import { handleApiError } from '@/server/auth/errorHandler';
import { supabaseAdmin } from '@/lib/supabase/server';
import { NotFoundError, ForbiddenError } from '@/contracts/errors';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/analyses/{analysisId}
 * 분석 결과 상세 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> }
) {
  try {
    const user = await authenticate(request);
    const { analysisId } = await params;

    const { data: analysis, error } = await supabaseAdmin
      .from('analyses')
      .select('*')
      .eq('id', analysisId)
      .single();

    if (error || !analysis) {
      throw new NotFoundError('Analysis');
    }

    // Check ownership (customers can only see their own, operators can see all)
    if (user.role === 'CUSTOMER' && analysis.customer_id !== user.id) {
      throw new ForbiddenError();
    }

    // Parse stored JSONB fields
    const providerResult = analysis.provider_result as { recommendations?: unknown[]; sourceProduct?: { confidence?: number } } | null;
    const damages = analysis.damages as Array<{ type: string; location: string; severity: number; confidence: number }>;
    const warnings = analysis.warnings as Array<{ code: string; message: string }>;

    // Get recommendations from provider_result or empty array
    const recommendations = providerResult?.recommendations ?? [];

    return NextResponse.json({
      id: analysis.id,
      status: analysis.status,
      modeUsed: analysis.mode_used,
      sourceProduct: {
        category: analysis.source_category,
        materialType: analysis.material_type,
        confidence: providerResult?.sourceProduct?.confidence ?? 0.5,
      },
      condition: {
        grade: analysis.condition_grade,
        overallDamageSeverity: analysis.damage_severity,
        summary: analysis.summary,
      },
      damages,
      imageQuality: {
        status: 'ACCEPTABLE',
        issues: [],
      },
      authenticitySignal: analysis.authenticity_signal,
      reusableMaterialRate: analysis.reusable_rate,
      estimatedReusableAreaCm2: analysis.reusable_area_cm2,
      longStripAvailable: analysis.long_strip_available,
      recommendations,
      esgPreview: {
        methodologyVersion: analysis.methodology_version,
        estimatedCarbonSavingKgCo2e: parseFloat(analysis.estimated_carbon_saving_kg),
        disclaimer: '해커톤용 추정치이며 공인 ESG 수치가 아닙니다.',
      },
      provider: {
        name: analysis.provider_name,
        model: analysis.provider_model,
        requestId: analysis.provider_request_id,
      },
      warnings,
      createdAt: analysis.created_at,
      completedAt: analysis.completed_at,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
