import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/server/auth/middleware';
import { handleApiError } from '@/server/auth/errorHandler';
import { supabaseAdmin } from '@/lib/supabase/server';
import { NotFoundError, ForbiddenError } from '@/contracts/errors';
import { resolveEffectiveStatus } from '@/server/applications/resolveMockStatus';
import { ShipmentStatus } from '@/contracts/application';

export const dynamic = 'force-dynamic';

/**
 * Map application status to shipment status
 */
function getShipmentStatus(appStatus: string): ShipmentStatus | null {
  const mapping: Record<string, ShipmentStatus> = {
    APPROVED: 'PICKUP_RESERVED',
    RECEIVING_PRODUCT: 'PICKUP_IN_PROGRESS',
    PRODUCT_RECEIVED: 'AT_WORKSHOP',
    IN_PRODUCTION: 'AT_WORKSHOP',
    QUALITY_CHECK: 'AT_WORKSHOP',
    SHIPPED: 'OUT_FOR_DELIVERY',
    COMPLETED: 'DELIVERED',
  };

  return mapping[appStatus] ?? null;
}

/**
 * GET /api/v1/applications/{applicationId}/shipment
 * Mock 운송장 조회
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

    const shipmentStatus = getShipmentStatus(effectiveStatus);

    if (!shipmentStatus) {
      return NextResponse.json({
        shipmentStatus: null,
        message: '아직 배송 정보가 생성되지 않았습니다.',
      });
    }

    // Generate mock tracking number
    const dateStr = application.created_at.slice(0, 10).replace(/-/g, '');
    const appSeq = application.application_number.split('-').pop();
    const trackingNumber = `RB${dateStr}${appSeq}`;

    return NextResponse.json({
      applicationId: application.id,
      shipmentStatus,
      carrierCode: 'MCM_REBORN_DEMO',
      carrierName: 'MCM RE:BORN Demo Logistics',
      trackingNumber,
      trackingUrl: null,
      estimatedDeliveryDate: null,
      shippingAddress: application.shipping_address,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
