import { NextRequest, NextResponse } from 'next/server';
import { authenticate, requireRole } from '@/server/auth/middleware';
import { handleApiError } from '@/server/auth/errorHandler';
import { processMockPayment } from '@/server/payments/mockPaymentAdapter';
import { ValidationError } from '@/contracts/errors';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const MockPaymentRequestSchema = z.object({
  method: z.literal('DEMO_CARD'),
  simulate: z.enum(['SUCCESS', 'FAILURE']).default('SUCCESS'),
});

/**
 * POST /api/v1/applications/{applicationId}/mock-payment
 * Mock 결제 완료
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  try {
    const user = await authenticate(request);
    requireRole(user, ['CUSTOMER']);

    const { applicationId } = await params;

    const idempotencyKey = request.headers.get('idempotency-key');
    if (!idempotencyKey) {
      throw new ValidationError('Idempotency-Key header is required');
    }

    const body = await request.json();
    const validated = MockPaymentRequestSchema.parse(body);

    const result = await processMockPayment({
      applicationId,
      customerId: user.id,
      ...validated,
      idempotencyKey,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ValidationError('Invalid request body', { zodErrors: error.issues }));
    }
    return handleApiError(error);
  }
}
