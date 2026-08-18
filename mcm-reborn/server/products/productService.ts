import { supabaseAdmin } from '@/lib/supabase/server';
import { ProductCard, ProductDetail, RecommendationReasonCode } from '@/contracts/product';
import { NotFoundError } from '@/contracts/errors';

/**
 * Get products with recommendations for an analysis
 */
export async function getProductsForAnalysis(
  analysisId: string
): Promise<ProductCard[]> {
  // Get analysis with recommendations
  const { data: analysis, error: analysisError } = await supabaseAdmin
    .from('analyses')
    .select('id, recommendations')
    .eq('id', analysisId)
    .single();

  if (analysisError || !analysis) {
    throw new NotFoundError('Analysis');
  }

  // Get all active products
  const { data: products, error: productsError } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('active', true)
    .order('required_area_cm2', { ascending: true });

  if (productsError || !products) {
    throw new Error('Failed to fetch products');
  }

  const recommendations = (analysis.recommendations as Array<{ productId: string; eligible: boolean; score: number; reasonCodes: RecommendationReasonCode[] }>) ?? [];

  // Map products with recommendations
  return products.map((p) => {
    const rec = recommendations.find((r) => r.productId === p.id) ?? {
      eligible: false,
      score: 0,
      reasonCodes: [] as RecommendationReasonCode[],
    };

    return {
      id: p.id,
      code: p.code,
      name: p.name,
      category: p.category,
      mockPrice: p.mock_price,
      requiredAreaCm2: p.required_area_cm2,
      listImage: p.list_image,
      has3d: true as const,
      recommendation: rec,
    };
  }).sort((a, b) => b.recommendation.score - a.recommendation.score);
}

/**
 * Get product detail
 */
export async function getProductDetail(
  productId: string,
  analysisId?: string | null
): Promise<ProductDetail> {
  const { data: product, error } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('active', true)
    .single();

  if (error || !product) {
    throw new NotFoundError('Product');
  }

  let recommendation: { eligible: boolean; score: number; reasonCodes: RecommendationReasonCode[] } = {
    eligible: false,
    score: 0,
    reasonCodes: [],
  };

  if (analysisId) {
    const { data: analysis } = await supabaseAdmin
      .from('analyses')
      .select('recommendations')
      .eq('id', analysisId)
      .single();

    if (analysis) {
      const recs = (analysis.recommendations as Array<{ productId: string; eligible: boolean; score: number; reasonCodes: RecommendationReasonCode[] }>) ?? [];
      const rec = recs.find((r) => r.productId === productId);
      if (rec) {
        recommendation = rec;
      }
    }
  }

  return {
    id: product.id,
    code: product.code,
    name: product.name,
    category: product.category,
    description: product.description,
    mockPrice: product.mock_price,
    requiredAreaCm2: product.required_area_cm2,
    dimensions: product.dimensions,
    listImage: product.list_image,
    model3d: product.model_3d,
    optionGroups: product.option_groups,
    has3d: true as const,
    recommendation,
  };
}
