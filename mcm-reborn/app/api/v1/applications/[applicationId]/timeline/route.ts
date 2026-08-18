import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/server/auth/middleware';
import { handleApiError } from '@/server/auth/errorHandler';
import { supabaseAdmin } from '@/lib/supabase/server';
import { NotFoundError, ForbiddenError } from '@/contracts/errors';
import { resolveEffectiveStatus } from '@/server/applications/resolveMockStatus';
import { ApplicationStatus, TimelineStep, TimelineStepState } from '@/contracts/application';

export const dynamic = 'force-dynamic';

const TIMELINE_STEPS: Array<{ status: ApplicationStatus; label: string }> = [
  { status: 'PENDING_PAYMENT', label: '결제 대기' },
  { status: 'PENDING_APPROVAL', label: '승인 대기' },
  { status: 'APPROVED', label: '승인 완료' },
  { status: 'RECEIVING_PRODUCT', label: '제품 수거 중' },
  { status: 'PRODUCT_RECEIVED', label: '제품 수거 완료' },
  { status: 'IN_PRODUCTION', label: '제작 중' },
  { status: 'QUALITY_CHECK', label: '품질 검수' },
  { status: 'SHIPPED', label: '배송 중' },
  { status: 'COMPLETED', label: '완료' },
];

/**
 * GET /api/v1/applications/{applicationId}/timeline
 * 신청 진행 타임라인 조회
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
      .select('*')
      .eq('id', applicationId)
      .single();

    if (error || !application) {
      throw new NotFoundError('Application');
    }

    if (user.role === 'CUSTOMER' && application.customer_id !== user.id) {
      throw new ForbiddenError();
    }

    const effectiveStatus = resolveEffectiveStatus(
      application.persisted_status,
      application.status_override,
      application.approved_at ? new Date(application.approved_at) : null
    );

    // Build timeline
    const currentIndex = TIMELINE_STEPS.findIndex((s) => s.status === effectiveStatus);

    const steps: TimelineStep[] = TIMELINE_STEPS.map((step, idx) => {
      let state: TimelineStepState = 'UPCOMING';
      let occurredAt: string | null = null;

      if (idx < currentIndex) {
        state = 'COMPLETED';
      } else if (idx === currentIndex) {
        state = 'CURRENT';
        if (step.status === 'APPROVED' && application.approved_at) {
          occurredAt = application.approved_at;
        }
      }

      return {
        status: step.status,
        label: step.label,
        state,
        occurredAt,
        description: null,
      };
    });

    return NextResponse.json({
      applicationId: application.id,
      currentStatus: effectiveStatus,
      steps,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
