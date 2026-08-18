import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/server/auth/middleware';
import { handleApiError } from '@/server/auth/errorHandler';
import { supabaseAdmin } from '@/lib/supabase/server';
import { NotFoundError, ForbiddenError, ConflictError } from '@/contracts/errors';
import { resolveEffectiveStatus } from '@/server/applications/resolveMockStatus';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/applications/{applicationId}/certificate
 * ESG 보증서 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const user = await authenticate(request);
    const { applicationId } = await params;

    const { data: application, error: appError } = await supabaseAdmin
      .from('applications')
      .select(`
        *,
        analysis:analyses!applications_analysis_id_fkey(
          source_category,
          reusable_rate,
          reusable_area_cm2,
          estimated_carbon_saving_kg
        ),
        product:products!applications_product_id_fkey(name)
      `)
      .eq('id', applicationId)
      .single();

    if (appError || !application) {
      throw new NotFoundError('Application');
    }

    // Check access
    if (user.role === 'CUSTOMER' && application.customer_id !== user.id) {
      throw new ForbiddenError();
    }

    // Calculate effective status
    const effectiveStatus = resolveEffectiveStatus(
      application.persisted_status,
      application.status_override,
      application.approved_at ? new Date(application.approved_at) : null
    );

    // Certificate only available for COMPLETED applications
    if (effectiveStatus !== 'COMPLETED') {
      throw new ConflictError(
        'CERTIFICATE_NOT_READY',
        '완료된 신청만 보증서를 확인할 수 있습니다.',
        { currentStatus: effectiveStatus }
      );
    }

    // Get or create certificate
    let { data: certificate } = await supabaseAdmin
      .from('esg_certificates')
      .select('*')
      .eq('application_id', applicationId)
      .single();

    if (!certificate) {
      // Generate certificate
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const { count } = await supabaseAdmin
        .from('esg_certificates')
        .select('*', { count: 'exact', head: true })
        .gte('issued_at', `${now.toISOString().slice(0, 10)}T00:00:00Z`);

      const seqNum = String((count ?? 0) + 1).padStart(4, '0');
      const certificateNumber = `ESG-RB-${dateStr}-${seqNum}`;
      const verificationCode = `MRB-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const analysis = application.analysis as { source_category: string; reusable_rate: number; reusable_area_cm2: number; estimated_carbon_saving_kg: string };
      const product = application.product as { name: string };

      const { data: newCert, error: certError } = await supabaseAdmin
        .from('esg_certificates')
        .insert({
          application_id: applicationId,
          certificate_number: certificateNumber,
          verification_code: verificationCode,
          source_category: analysis.source_category,
          reborn_product_name: product.name,
          reused_material_rate: analysis.reusable_rate,
          reused_area_cm2: analysis.reusable_area_cm2,
          estimated_carbon_saving_kg: parseFloat(analysis.estimated_carbon_saving_kg),
          methodology_version: 'DEMO_LCA_V1',
          issued_at: now.toISOString(),
        })
        .select()
        .single();

      if (certError) {
        throw new Error(`Failed to create certificate: ${certError.message}`);
      }

      certificate = newCert;
    }

    return NextResponse.json({
      certificateId: certificate.id,
      certificateNumber: certificate.certificate_number,
      applicationNumber: application.application_number,
      sourceCategory: certificate.source_category,
      rebornProduct: certificate.reborn_product_name,
      reusedMaterialRate: certificate.reused_material_rate,
      reusedAreaCm2: certificate.reused_area_cm2,
      estimatedCarbonSavingKgCo2e: parseFloat(certificate.estimated_carbon_saving_kg),
      methodologyVersion: certificate.methodology_version,
      issuedAt: certificate.issued_at,
      verificationCode: certificate.verification_code,
      disclaimer: '해커톤용 가상 보증서이며 법적·상업적 효력이 없습니다.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
