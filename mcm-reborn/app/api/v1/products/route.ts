import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/server/auth/middleware';
import { handleApiError } from '@/server/auth/errorHandler';
import { getProductsForAnalysis } from '@/server/products/productService';
import { ValidationError } from '@/contracts/errors';

/**
 * GET /api/v1/products?analysisId={analysisId}
 * 추천 제품 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    await authenticate(request);

    const url = new URL(request.url);
    const analysisId = url.searchParams.get('analysisId');

    if (!analysisId) {
      throw new ValidationError('analysisId query parameter is required');
    }

    const products = await getProductsForAnalysis(analysisId);

    return NextResponse.json({
      items: products,
      page: 0,
      size: products.length,
      totalElements: products.length,
      totalPages: 1,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
