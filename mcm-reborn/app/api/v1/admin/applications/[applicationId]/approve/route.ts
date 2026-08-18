import { NextRequest, NextResponse } from 'next/server';
import { authenticate, requireRole } from '@/server/auth/middleware';
import { handleApiError } from '@/server/auth/errorHandler';
import { supabaseAdmin } from '@/lib/supabase/server';
import { ConflictError, NotFoundError, ValidationError } from '@/contracts/errors';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/admin/applications/{applicationId}/approve
 * 신청 승인 (운영자 전용)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const user = await authenticate(request);
    requireRole(user, ['OPERATOR']);

    const { applicationId } = await params;

    const idempotencyKey = request.headers.get('idempotency-key');
    if (!idempotencyKey) {
      throw new ValidationError('Idempotency-Key header is required');
    }

    // Check idempotency - if already approved with same key, return same result
    const { data: application, error: appError } = await supabaseAdmin
      .from('applications')
      .select('*, profiles!inner(display_name)')
      .eq('id', applicationId)
      .single();

    if (appError || !application) {
      throw new NotFoundError('Application');
    }

    // If already approved
    if (application.persisted_status === 'APPROVED' && application.approved_at) {
      return NextResponse.json({
        id: application.id,
        status: 'APPROVED',
        approvedAt: application.approved_at,
        approvedBy: {
          id: application.approved_by ?? user.id,
          displayName: user.displayName,
        },
        mockProgressProfile: 'FAST_DEMO',
      });
    }

    // Can only approve PENDING_APPROVAL status
    if (application.persisted_status !== 'PENDING_APPROVAL') {
      throw new ConflictError(
        'APPLICATION_INVALID_STATE',
        '승인 대기 상태의 신청만 승인할 수 있습니다.',
        {
          currentStatus: application.persisted_status,
          expectedStatus: 'PENDING_APPROVAL',
        }
      );
    }

    const now = new Date().toISOString();

    // Update application
    await supabaseAdmin
      .from('applications')
      .update({
        persisted_status: 'APPROVED',
        approved_at: now,
        approved_by: user.id,
        progress_profile: 'FAST_DEMO',
      })
      .eq('id', applicationId);

    return NextResponse.json({
      id: applicationId,
      status: 'APPROVED',
      approvedAt: now,
      approvedBy: {
        id: user.id,
        displayName: user.displayName,
      },
      mockProgressProfile: 'FAST_DEMO',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
