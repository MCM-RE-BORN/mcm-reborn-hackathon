import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ValidationError } from '@/contracts/errors';
import { getAnalysisById } from '@/server/analyses/analysisService';
import { handleApiError } from '@/server/auth/errorHandler';
import { authenticate } from '@/server/auth/middleware';

export const runtime = 'nodejs';

type AnalysisRouteContext = {
  params: Promise<{ analysisId: string }>;
};

export async function GET(
  request: Request,
  { params }: AnalysisRouteContext,
): Promise<Response> {
  try {
    const user = await authenticate(request);
    const parsed = z.string().uuid().safeParse((await params).analysisId);
    if (!parsed.success) {
      throw new ValidationError('analysisId must be a UUID', {
        field: 'analysisId',
      });
    }
    const analysis = await getAnalysisById(parsed.data, user);
    return NextResponse.json(analysis, {
      headers: { 'Cache-Control': 'no-store' },
      status: 200,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
