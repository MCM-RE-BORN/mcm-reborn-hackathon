import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/server/auth/middleware';
import { handleApiError } from '@/server/auth/errorHandler';
import { supabaseAdmin } from '@/lib/supabase/server';
import { ValidationError } from '@/contracts/errors';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const EventRequestSchema = z.object({
  eventName: z.enum([
    'ANALYSIS_STARTED',
    'ANALYSIS_COMPLETED',
    'ANALYSIS_FALLBACK_USED',
    'PRODUCT_LIST_VIEWED',
    'PRODUCT_DETAIL_VIEWED',
    'APPLICATION_CREATED',
    'MOCK_PAYMENT_COMPLETED',
    'APPLICATION_APPROVED',
    'CERTIFICATE_VIEWED',
  ]),
  occurredAt: z.string().datetime(),
  sessionId: z.string().uuid().optional(),
  analysisId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  applicationId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /api/v1/events
 * KPI 이벤트 기록 (선택적 인증)
 */
export async function POST(request: NextRequest) {
  try {
    // Try to authenticate, but don't fail if missing token
    let userId: string | null = null;
    try {
      const user = await authenticate(request);
      userId = user.id;
    } catch {
      // Anonymous event tracking allowed
    }

    const body = await request.json();
    const event = EventRequestSchema.parse(body);

    // Insert event
    const { error } = await supabaseAdmin.from('analytics_events').insert({
      user_id: userId,
      event_name: event.eventName,
      occurred_at: event.occurredAt,
      session_id: event.sessionId ?? null,
      analysis_id: event.analysisId ?? null,
      product_id: event.productId ?? null,
      application_id: event.applicationId ?? null,
      metadata: event.metadata ?? {},
    });

    if (error) {
      console.error('[Analytics] Failed to record event:', error);
      // Don't fail the request for analytics errors
    }

    return NextResponse.json({ recorded: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ValidationError('Invalid event data', { zodErrors: error.issues }));
    }
    // Don't fail for analytics errors
    console.error('[Analytics] Error:', error);
    return NextResponse.json({ recorded: false }, { status: 200 });
  }
}
