import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/server/auth/middleware';
import { handleApiError } from '@/server/auth/errorHandler';
import { supabaseAdmin } from '@/lib/supabase/server';
import { NotFoundError, ForbiddenError } from '@/contracts/errors';
import { resolveEffectiveStatus } from '@/server/applications/resolveMockStatus';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/applications/{applicationId}
 * 신청 상세 조회 (고객·운영자 공통)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const user = await authenticate(request);
    const { applicationId } = await params;

    const { data: application, error } = await supabaseAdmin
      .from('applications')
      .select(`
        *,
        analysis:analyses!applications_analysis_id_fkey(
          id,
          source_category,
          reusable_rate,
          reusable_area_cm2
        ),
        product:products!applications_product_id_fkey(
          id,
          code,
          name,
          category
        )
      `)
      .eq('id', applicationId)
      .single();

    if (error || !application) {
      throw new NotFoundError('Application');
    }

    // Check access: customers can only see their own, operators can see all
    if (user.role === 'CUSTOMER' && application.customer_id !== user.id) {
      throw new ForbiddenError();
    }

    // Calculate effective status
    const effectiveStatus = resolveEffectiveStatus(
      application.persisted_status,
      application.status_override,
      application.approved_at ? new Date(application.approved_at) : null
    );

    return NextResponse.json({
      id: application.id,
      applicationNumber: application.application_number,
      status: effectiveStatus,
      analysis: application.analysis,
      product: application.product,
      selectedOptions: application.selected_options,
      shippingAddress: application.shipping_address,
      amount: application.amount,
      approvedAt: application.approved_at,
      approvedBy: application.approved_by
        ? { id: application.approved_by }
        : null,
      createdAt: application.created_at,
      updatedAt: application.updated_at,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
