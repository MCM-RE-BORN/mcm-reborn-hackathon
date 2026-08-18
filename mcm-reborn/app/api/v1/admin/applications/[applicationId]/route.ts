import { NextRequest, NextResponse } from 'next/server';
import { authenticate, requireRole } from '@/server/auth/middleware';
import { handleApiError } from '@/server/auth/errorHandler';
import { supabaseAdmin } from '@/lib/supabase/server';
import { NotFoundError } from '@/contracts/errors';
import { resolveEffectiveStatus } from '@/server/applications/resolveMockStatus';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/admin/applications/{applicationId}
 * 운영자 신청 상세 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const user = await authenticate(request);
    requireRole(user, ['OPERATOR']);

    const { applicationId } = await params;

    const { data: application, error } = await supabaseAdmin
      .from('applications')
      .select(`
        *,
        customer:profiles!applications_customer_id_fkey(id, display_name, email),
        analysis:analyses!applications_analysis_id_fkey(*),
        product:products!applications_product_id_fkey(*)
      `)
      .eq('id', applicationId)
      .single();

    if (error || !application) {
      throw new NotFoundError('Application');
    }

    const effectiveStatus = resolveEffectiveStatus(
      application.persisted_status,
      application.status_override,
      application.approved_at ? new Date(application.approved_at) : null
    );

    return NextResponse.json({
      id: application.id,
      applicationNumber: application.application_number,
      status: effectiveStatus,
      customer: application.customer,
      analysis: application.analysis,
      product: application.product,
      selectedOptions: application.selected_options,
      shippingAddress: application.shipping_address,
      amount: application.amount,
      consents: application.consents,
      approvedAt: application.approved_at,
      createdAt: application.created_at,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
