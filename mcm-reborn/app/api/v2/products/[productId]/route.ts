import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ValidationError } from '@/contracts/errors';
import { handleApiError } from '@/server/auth/errorHandler';
import { authenticate } from '@/server/auth/middleware';
import { getProductDetail } from '@/server/products/productService';

export const runtime = 'nodejs';

type ProductRouteContext = {
  params: Promise<{ productId: string }>;
};

const ProductDetailQuerySchema = z.object({
  analysisId: z.string().uuid(),
});

export async function GET(
  request: Request,
  { params }: ProductRouteContext,
): Promise<Response> {
  try {
    const user = await authenticate(request);
    const productId = z.string().uuid().parse((await params).productId);
    const url = new URL(request.url);
    const query = ProductDetailQuerySchema.parse({
      analysisId: url.searchParams.get('analysisId'),
    });
    const product = await getProductDetail(
      productId,
      query.analysisId,
      user,
    );
    return NextResponse.json(product, {
      headers: { 'Cache-Control': 'no-store' },
      status: 200,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(
        new ValidationError('Invalid path or query parameters', {
          issues: error.issues,
        }),
      );
    }
    return handleApiError(error);
  }
}
