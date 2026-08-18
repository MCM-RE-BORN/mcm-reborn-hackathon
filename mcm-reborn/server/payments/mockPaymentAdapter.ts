import { supabaseAdmin } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';
import { ConflictError, NotFoundError } from '@/contracts/errors';

export interface MockPaymentInput {
  applicationId: string;
  customerId: string;
  method: 'DEMO_CARD';
  simulate: 'SUCCESS' | 'FAILURE';
  idempotencyKey: string;
}

/**
 * Process mock payment
 */
export async function processMockPayment(input: MockPaymentInput) {
  const { applicationId, customerId, method, simulate, idempotencyKey } = input;

  // Check idempotency
  const { data: existingPayment } = await supabaseAdmin
    .from('mock_payments')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .single();

  if (existingPayment) {
    const { data: app } = await supabaseAdmin
      .from('applications')
      .select('persisted_status')
      .eq('id', applicationId)
      .single();

    return {
      paymentId: existingPayment.id,
      transactionId: existingPayment.transaction_id,
      status: 'PAID',
      paidAmount: existingPayment.paid_amount,
      paidAt: existingPayment.paid_at,
      applicationStatus: app?.persisted_status ?? 'PENDING_PAYMENT',
    };
  }

  // Get application
  const { data: application, error: appError } = await supabaseAdmin
    .from('applications')
    .select('*')
    .eq('id', applicationId)
    .eq('customer_id', customerId)
    .single();

  if (appError || !application) {
    throw new NotFoundError('Application');
  }

  if (application.persisted_status !== 'PENDING_PAYMENT') {
    throw new ConflictError(
      'PAYMENT_ALREADY_COMPLETED',
      'Payment has already been processed',
      { currentStatus: application.persisted_status }
    );
  }

  if (simulate === 'FAILURE') {
    throw new Error('MOCK_PAYMENT_SIMULATED_FAILURE');
  }

  // Generate transaction ID
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const { count } = await supabaseAdmin
    .from('mock_payments')
    .select('*', { count: 'exact', head: true })
    .gte('paid_at', `${now.toISOString().slice(0, 10)}T00:00:00Z`);

  const seqNum = String((count ?? 0) + 1).padStart(4, '0');
  const transactionId = `MOCK-PAY-${dateStr}-${seqNum}`;

  const paymentId = randomUUID();

  // Create payment record
  await supabaseAdmin.from('mock_payments').insert({
    id: paymentId,
    application_id: applicationId,
    transaction_id: transactionId,
    method,
    status: 'PAID',
    paid_amount: application.amount,
    paid_at: now.toISOString(),
    idempotency_key: idempotencyKey,
  });

  // Update application status
  await supabaseAdmin
    .from('applications')
    .update({ persisted_status: 'PENDING_APPROVAL' })
    .eq('id', applicationId);

  return {
    paymentId,
    transactionId,
    status: 'PAID',
    paidAmount: application.amount,
    paidAt: now.toISOString(),
    applicationStatus: 'PENDING_APPROVAL',
  };
}
