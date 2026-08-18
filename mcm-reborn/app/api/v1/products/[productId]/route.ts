import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/server/auth/middleware';
import { handleApiError } from '@/server/auth/errorHandler';
import { getProductDetail } from '@/server/products/productService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/products/{productId}?analysisId={analysisId}
 * 제품 및 3D 상세 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    await authenticate(request);

    const { productId } = await params;
    const url = new URL(request.url);
    const analysisId = url.searchParams.get('analysisId');

    const product = await getProductDetail(productId, analysisId);

    return NextResponse.json(product);
  } catch (error) {
    return handleApiError(error);
  }
}
