import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/server/auth/errorHandler';
import { supabaseAdmin } from '@/lib/supabase/server';
import { NotFoundError } from '@/contracts/errors';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/certificates/{certificateId}/verify
 * 보증서 공개 검증 (인증 불필요)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ certificateId: string }> }
) {
  try {
    const { certificateId } = await params;

    const { data: certificate, error } = await supabaseAdmin
      .from('esg_certificates')
      .select(`
        *,
        application:applications!esg_certificates_application_id_fkey(
          application_number,
          created_at
        )
      `)
      .eq('id', certificateId)
      .single();

    if (error || !certificate) {
      throw new NotFoundError('Certificate');
    }

    const application = certificate.application as { application_number: string; created_at: string } | null;

    return NextResponse.json({
      valid: true,
      certificateNumber: certificate.certificate_number,
      applicationNumber: application?.application_number,
      sourceCategory: certificate.source_category,
      rebornProduct: certificate.reborn_product_name,
      reusedMaterialRate: certificate.reused_material_rate,
      reusedAreaCm2: certificate.reused_area_cm2,
      estimatedCarbonSavingKgCo2e: parseFloat(certificate.estimated_carbon_saving_kg),
      methodologyVersion: certificate.methodology_version,
      issuedAt: certificate.issued_at,
      verificationCode: certificate.verification_code,
      disclaimer: '해커톤용 가상 보증서이며 법적·상업적 효력이 없습니다.',
      notice: 'This is a demonstration certificate for hackathon purposes only.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
