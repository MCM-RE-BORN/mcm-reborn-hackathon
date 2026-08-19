import {
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  UpstreamError,
} from '@/contracts/errors';
import {
  ProductCategorySchema,
  ProductCodeSchema,
  type ImageAsset,
  type OptionGroup,
  type Product3D,
  type ProductCard,
  type ProductDetail,
} from '@/contracts/product';
import {
  createAdminSupabaseClient,
  createUserSupabaseClient,
} from '@/lib/supabase/server';
import {
  getAnalysisById,
  type Analysis,
  type AnalysisViewer,
} from '@/server/analyses/analysisService';

type ProductRow = {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  required_area_cm2: number;
  mock_price_krw: number;
  estimated_duration: string;
  dimensions: unknown;
  list_image: unknown;
  model_3d: unknown;
  model_3d_ready: boolean;
  option_groups: unknown;
  active: boolean;
  sort_order: number;
};

export interface PagedProductCards {
  items: ProductCard[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** Return recommendation-ranked active products for an authorized analysis. */
export async function listProductsForAnalysis(
  analysisId: string,
  viewer: AnalysisViewer,
  page: number,
  size: number,
): Promise<PagedProductCards> {
  const analysis = await getAnalysisById(analysisId, viewer);
  if (analysis.authenticityPrecheck.status === 'INELIGIBLE') {
    return {
      items: [],
      page,
      size,
      totalElements: 0,
      totalPages: 0,
    };
  }
  const products = await readActiveProducts(viewer);
  const recommendationByProduct = new Map(
    analysis.recommendations.map((recommendation) => [
      recommendation.productId,
      recommendation,
    ]),
  );
  const cards = products
    .map((product) =>
      productCard(product, recommendationByProduct.get(product.id)),
    )
    .sort(
      (left, right) =>
        right.recommendation.score - left.recommendation.score ||
        left.name.localeCompare(right.name, 'ko'),
    );
  const totalElements = cards.length;

  return {
    items: cards.slice(page * size, (page + 1) * size),
    page,
    size,
    totalElements,
    totalPages: Math.ceil(totalElements / size),
  };
}

/**
 * Compatibility helper for untouched v1 callers. New v2 code must use
 * listProductsForAnalysis so authorization context and pagination are explicit.
 */
export async function getProductsForAnalysis(
  analysisId: string,
  viewer?: AnalysisViewer,
): Promise<ProductCard[]> {
  if (!viewer) {
    throw new ForbiddenError('An authenticated viewer is required');
  }
  return (await listProductsForAnalysis(analysisId, viewer, 0, 100)).items;
}

/** Return one active product and its recommendation for an authorized analysis. */
export async function getProductDetail(
  productId: string,
  analysisId?: string | null,
  viewer?: AnalysisViewer,
): Promise<ProductDetail> {
  if (!analysisId) {
    throw new NotFoundError('Analysis');
  }
  if (!viewer?.accessToken) {
    throw new ForbiddenError('An authenticated viewer is required');
  }

  const analysis = await getAnalysisById(analysisId, viewer);
  if (analysis.authenticityPrecheck.status === 'INELIGIBLE') {
    throw new ForbiddenError('Products are unavailable for this analysis');
  }
  const userClient = createUserSupabaseClient(viewer.accessToken);
  const { data, error } = await userClient
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('active', true)
    .maybeSingle();
  if (error) {
    throw new ServiceUnavailableError('Product catalog is unavailable');
  }
  if (!data) {
    const admin = createAdminSupabaseClient();
    const { data: existence, error: existenceError } = await admin
      .from('products')
      .select('id')
      .eq('id', productId)
      .maybeSingle();
    if (existenceError) {
      throw new ServiceUnavailableError('Product catalog is unavailable');
    }
    if (existence) {
      throw new ForbiddenError('This product is not available');
    }
    throw new NotFoundError('Product');
  }

  return productDetail(data as unknown as ProductRow, analysis);
}

async function readActiveProducts(viewer: AnalysisViewer): Promise<ProductRow[]> {
  if (!viewer.accessToken) {
    throw new ForbiddenError('An authenticated viewer is required');
  }
  const userClient = createUserSupabaseClient(viewer.accessToken);
  const { data, error } = await userClient
    .from('products')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) {
    throw new ServiceUnavailableError('Product catalog is unavailable');
  }
  return (data ?? []) as unknown as ProductRow[];
}

function productCard(
  product: ProductRow,
  recommendation?: Analysis['recommendations'][number],
): ProductCard {
  return {
    id: requireString(product.id, 'product.id'),
    code: ProductCodeSchema.parse(product.code),
    name: requireString(product.name, 'product.name'),
    category: ProductCategorySchema.parse(product.category),
    mockPrice: {
      amount: requireNonNegativeInteger(
        product.mock_price_krw,
        'product.mock_price_krw',
      ),
      currency: 'KRW',
    },
    estimatedDuration: requireString(
      product.estimated_duration,
      'product.estimated_duration',
    ),
    requiredAreaCm2: requirePositiveInteger(
      product.required_area_cm2,
      'product.required_area_cm2',
    ),
    listImage: parseImageAsset(product.list_image),
    has3d: product.model_3d_ready === true,
    recommendation: recommendation
      ? {
          eligible: recommendation.eligible,
          score: recommendation.score,
          reasonCodes: recommendation.reasonCodes,
        }
      : { eligible: false, score: 0, reasonCodes: [] },
  };
}

function productDetail(product: ProductRow, analysis: Analysis): ProductDetail {
  const recommendation = analysis.recommendations.find(
    (candidate) => candidate.productId === product.id,
  );
  const card = productCard(product, recommendation);
  const dimensions = requireRecord(product.dimensions, 'product.dimensions');

  return {
    ...card,
    description: requireString(product.description, 'product.description'),
    dimensions: {
      widthMm: requirePositiveInteger(
        dimensions.widthMm,
        'product.dimensions.widthMm',
      ),
      heightMm: requirePositiveInteger(
        dimensions.heightMm,
        'product.dimensions.heightMm',
      ),
      depthMm: requireNonNegativeInteger(
        dimensions.depthMm,
        'product.dimensions.depthMm',
      ),
    },
    model3d: product.model_3d_ready === true
      ? parseProduct3d(product.model_3d)
      : null,
    optionGroups: parseOptionGroups(product.option_groups),
  };
}

function parseImageAsset(value: unknown): ImageAsset {
  const image = requireRecord(value, 'product.list_image');
  return {
    url: requireString(image.url, 'product.list_image.url'),
    alt: requireString(image.alt, 'product.list_image.alt'),
    width: requirePositiveInteger(image.width, 'product.list_image.width'),
    height: requirePositiveInteger(image.height, 'product.list_image.height'),
    aspectRatio: requireString(
      image.aspectRatio,
      'product.list_image.aspectRatio',
    ),
  };
}

function parseProduct3d(value: unknown): Product3D {
  const model = requireRecord(value, 'product.model_3d');
  if (model.format !== 'GLB' && model.format !== 'GLTF') {
    throw new UpstreamError('Stored product 3D format is invalid');
  }
  if (typeof model.autoRotate !== 'boolean') {
    throw new UpstreamError('Stored product 3D autoRotate is invalid');
  }
  if (!Array.isArray(model.availableVariants)) {
    throw new UpstreamError('Stored product 3D variants are invalid');
  }

  return {
    format: model.format,
    url: requireString(model.url, 'product.model_3d.url'),
    posterUrl: requireString(model.posterUrl, 'product.model_3d.posterUrl'),
    environmentImageUrl:
      model.environmentImageUrl === null || model.environmentImageUrl === undefined
        ? null
        : requireString(
            model.environmentImageUrl,
            'product.model_3d.environmentImageUrl',
          ),
    cameraOrbit: requireString(
      model.cameraOrbit,
      'product.model_3d.cameraOrbit',
    ),
    cameraTarget: requireString(
      model.cameraTarget,
      'product.model_3d.cameraTarget',
    ),
    fieldOfView: requireString(
      model.fieldOfView,
      'product.model_3d.fieldOfView',
    ),
    autoRotate: model.autoRotate,
    availableVariants: model.availableVariants.map((variant) => {
      const record = requireRecord(variant, 'product.model_3d.variant');
      return {
        key: requireString(record.key, 'product.model_3d.variant.key'),
        label: requireString(record.label, 'product.model_3d.variant.label'),
      };
    }),
  };
}

function parseOptionGroups(value: unknown): OptionGroup[] {
  if (!Array.isArray(value)) {
    throw new UpstreamError('Stored product option groups are invalid');
  }
  return value.map((group) => {
    const record = requireRecord(group, 'product.option_group');
    if (record.type !== 'SELECT' && record.type !== 'TEXT') {
      throw new UpstreamError('Stored product option type is invalid');
    }
    if (typeof record.required !== 'boolean') {
      throw new UpstreamError('Stored product option requirement is invalid');
    }

    const options = record.options;
    return {
      key: requireString(record.key, 'product.option_group.key'),
      label: requireString(record.label, 'product.option_group.label'),
      required: record.required,
      type: record.type,
      options:
        options === undefined
          ? undefined
          : requireArray(options, 'product.option_group.options').map((option) => {
              const optionRecord = requireRecord(
                option,
                'product.option_group.option',
              );
              return {
                value: requireString(
                  optionRecord.value,
                  'product.option_group.option.value',
                ),
                label: requireString(
                  optionRecord.label,
                  'product.option_group.option.label',
                ),
                modelVariant:
                  optionRecord.modelVariant === null ||
                  optionRecord.modelVariant === undefined
                    ? null
                    : requireString(
                        optionRecord.modelVariant,
                        'product.option_group.option.modelVariant',
                      ),
              };
            }),
      maxLength:
        record.maxLength === null || record.maxLength === undefined
          ? null
          : requirePositiveInteger(
              record.maxLength,
              'product.option_group.maxLength',
            ),
    };
  });
}

function requireRecord(
  value: unknown,
  field: string,
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new UpstreamError(`Stored field is invalid: ${field}`);
  }
  return value as Record<string, unknown>;
}

function requireArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new UpstreamError(`Stored field is invalid: ${field}`);
  }
  return value;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new UpstreamError(`Stored field is invalid: ${field}`);
  }
  return value;
}

function requireNonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new UpstreamError(`Stored field is invalid: ${field}`);
  }
  return value;
}

function requirePositiveInteger(value: unknown, field: string): number {
  const parsed = requireNonNegativeInteger(value, field);
  if (parsed === 0) {
    throw new UpstreamError(`Stored field is invalid: ${field}`);
  }
  return parsed;
}
