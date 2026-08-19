import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ValidationError } from '@/contracts/errors';
import { handleApiError } from '@/server/auth/errorHandler';
import { authenticate } from '@/server/auth/middleware';
import { listProductsForAnalysis } from '@/server/products/productService';

export const runtime = 'nodejs';

const ProductQuerySchema = z.object({
  analysisId: z.string().uuid(),
  page: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(request: Request): Promise<Response> {
  try {
    const user = await authenticate(request);
    const url = new URL(request.url);
    const query = ProductQuerySchema.parse({
      analysisId: url.searchParams.get('analysisId'),
      page: url.searchParams.get('page') ?? undefined,
      size: url.searchParams.get('size') ?? undefined,
    });
    const products = await listProductsForAnalysis(
      query.analysisId,
      user,
      query.page,
      query.size,
    );
    return NextResponse.json(products, {
      headers: { 'Cache-Control': 'no-store' },
      status: 200,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(
        new ValidationError('Invalid query parameters', {
          issues: error.issues,
        }),
      );
    }
    return handleApiError(error);
  }
}
