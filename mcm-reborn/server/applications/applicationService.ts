import { supabaseAdmin } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';
import { ConflictError, NotFoundError, ValidationError } from '@/contracts/errors';
import { ApplicationStatus } from '@/contracts/application';

export interface CreateApplicationInput {
  customerId: string;
  analysisId: string;
  productId: string;
  selectedOptions: Record<string, string>;
  shippingAddress: {
    recipientName: string;
    phone: string;
    postalCode: string;
    address1: string;
    address2?: string | null;
  };
  consents: {
    demoTermsAccepted: boolean;
    aiEstimateNoticeAccepted: boolean;
    esgEstimateNoticeAccepted: boolean;
  };
  idempotencyKey: string;
}

/**
 * Create new application
 */
export async function createApplication(input: CreateApplicationInput) {
  const { customerId, analysisId, productId, selectedOptions, shippingAddress, consents, idempotencyKey } = input;

  // Check idempotency
  const { data: existing } = await supabaseAdmin
    .from('applications')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .eq('customer_id', customerId)
    .single();

  if (existing) {
    return {
      id: existing.id,
      applicationNumber: existing.application_number,
      status: existing.persisted_status,
      amount: existing.amount,
      createdAt: existing.created_at,
    };
  }

  // Verify analysis ownership
  const { data: analysis, error: analysisError } = await supabaseAdmin
    .from('analyses')
    .select('status, authenticity_signal, recommendations')
    .eq('id', analysisId)
    .eq('customer_id', customerId)
    .single();

  if (analysisError || !analysis) {
    throw new NotFoundError('Analysis');
  }

  if (analysis.status !== 'COMPLETED') {
    throw new ConflictError('ANALYSIS_NOT_COMPLETED', 'Analysis is not completed yet');
  }

  if (analysis.authenticity_signal === 'REVIEW_REQUIRED') {
    throw new ConflictError(
      'AUTHENTICITY_REVIEW_REQUIRED',
      '수동 검토가 필요한 분석입니다. 검토 완료 후 신청할 수 있습니다.'
    );
  }

  // Verify product recommendation
  const recommendations = (analysis.recommendations as Array<{ productId: string; eligible: boolean }>) ?? [];
  const rec = recommendations.find((r) => r.productId === productId);

  if (!rec || !rec.eligible) {
    throw new ConflictError(
      'PRODUCT_NOT_RECOMMENDED',
      'This product is not recommended for your analysis'
    );
  }

  // Get product details
  const { data: product, error: productError } = await supabaseAdmin
    .from('products')
    .select('mock_price, code')
    .eq('id', productId)
    .eq('active', true)
    .single();

  if (productError || !product) {
    throw new NotFoundError('Product');
  }

  // Validate consents
  if (!consents.demoTermsAccepted || !consents.aiEstimateNoticeAccepted || !consents.esgEstimateNoticeAccepted) {
    throw new ValidationError('All consents must be accepted');
  }

  // Generate application number
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const { count } = await supabaseAdmin
    .from('applications')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${now.toISOString().slice(0, 10)}T00:00:00Z`);

  const seqNum = String((count ?? 0) + 1).padStart(4, '0');
  const applicationNumber = `RB-${dateStr}-${seqNum}`;

  const applicationId = randomUUID();

  // Create application
  const { error: insertError } = await supabaseAdmin.from('applications').insert({
    id: applicationId,
    application_number: applicationNumber,
    customer_id: customerId,
    analysis_id: analysisId,
    product_id: productId,
    persisted_status: 'PENDING_PAYMENT',
    status_override: null,
    selected_options: selectedOptions,
    shipping_address: shippingAddress,
    amount: product.mock_price,
    consents,
    idempotency_key: idempotencyKey,
    created_at: now.toISOString(),
  });

  if (insertError) {
    throw new Error(`Failed to create application: ${insertError.message}`);
  }

  return {
    id: applicationId,
    applicationNumber,
    status: 'PENDING_PAYMENT' as ApplicationStatus,
    amount: product.mock_price,
    createdAt: now.toISOString(),
  };
}
