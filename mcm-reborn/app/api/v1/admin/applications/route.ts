import { NextRequest, NextResponse } from 'next/server';
import { authenticate, requireRole } from '@/server/auth/middleware';
import { handleApiError } from '@/server/auth/errorHandler';
import { supabaseAdmin } from '@/lib/supabase/server';
import { resolveEffectiveStatus } from '@/server/applications/resolveMockStatus';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/admin/applications
 * 운영자 신청 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticate(request);
    requireRole(user, ['OPERATOR']);

    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status');
    const page = parseInt(url.searchParams.get('page') ?? '0');
    const size = Math.min(parseInt(url.searchParams.get('size') ?? '20'), 100);

    let query = supabaseAdmin
      .from('applications')
      .select(`
        id,
        application_number,
        persisted_status,
        status_override,
        approved_at,
        amount,
        created_at,
        customer:profiles!applications_customer_id_fkey(display_name),
        product:products!applications_product_id_fkey(name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * size, (page + 1) * size - 1);

    if (statusFilter) {
      query = query.eq('persisted_status', statusFilter);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch applications: ${error.message}`);
    }

    const items = (data ?? []).map((app) => {
      const effectiveStatus = resolveEffectiveStatus(
        app.persisted_status,
        app.status_override,
        app.approved_at ? new Date(app.approved_at) : null
      );

      return {
        id: app.id,
        applicationNumber: app.application_number,
        status: effectiveStatus,
        customerName: (app.customer as unknown as { display_name: string } | null)?.display_name ?? 'Unknown',
        productName: (app.product as unknown as { name: string } | null)?.name ?? 'Unknown',
        amount: app.amount,
        createdAt: app.created_at,
      };
    });

    const totalElements = count ?? 0;
    const totalPages = Math.ceil(totalElements / size);

    return NextResponse.json({
      items,
      page,
      size,
      totalElements,
      totalPages,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
