import { NextRequest, NextResponse } from 'next/server';
import { authenticate, requireRole } from '@/server/auth/middleware';
import { handleApiError } from '@/server/auth/errorHandler';
import { createApplication } from '@/server/applications/applicationService';
import { ValidationError } from '@/contracts/errors';
import { z } from 'zod';

const AddressSchema = z.object({
  recipientName: z.string().min(1).max(100),
  phone: z.string().min(1).max(20),
  postalCode: z.string().min(1).max(10),
  address1: z.string().min(1).max(255),
  address2: z.string().max(255).nullable().optional(),
});

const ConsentsSchema = z.object({
  demoTermsAccepted: z.literal(true),
  aiEstimateNoticeAccepted: z.literal(true),
  esgEstimateNoticeAccepted: z.literal(true),
});

const CreateApplicationRequestSchema = z.object({
  analysisId: z.string().uuid(),
  productId: z.string().uuid(),
  selectedOptions: z.record(z.string(), z.string()),
  shippingAddress: AddressSchema,
  consents: ConsentsSchema,
});

/**
 * POST /api/v1/applications
 * 업사이클링 신청 생성
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticate(request);
    requireRole(user, ['CUSTOMER']);

    const idempotencyKey = request.headers.get('idempotency-key');
    if (!idempotencyKey) {
      throw new ValidationError('Idempotency-Key header is required');
    }

    const body = await request.json();
    const validated = CreateApplicationRequestSchema.parse(body);

    const application = await createApplication({
      customerId: user.id,
      ...validated,
      idempotencyKey,
    });

    return NextResponse.json(application, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ValidationError('Invalid request body', { zodErrors: error.issues }));
    }
    return handleApiError(error);
  }
}
