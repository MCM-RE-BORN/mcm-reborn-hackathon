import { z } from 'zod';

/**
 * Product codes and categories from OpenAPI
 */
export const ProductCodeSchema = z.enum([
  'REBORN_PASSPORT_WALLET',
  'REBORN_CARD_WALLET',
  'REBORN_NAME_TAG',
  'REBORN_KEYRING',
]);

export const ProductCategorySchema = z.enum([
  'PASSPORT_WALLET',
  'CARD_WALLET',
  'NAME_TAG',
  'KEYRING',
]);

export const RecommendationReasonCodeSchema = z.enum([
  'SUFFICIENT_AREA',
  'PATTERN_VISIBILITY',
  'LOW_DAMAGE_REGION_AVAILABLE',
  'USES_SMALL_REMNANTS',
  'LONG_STRIP_AVAILABLE',
  'INSUFFICIENT_AREA',
]);

export type ProductCode = z.infer<typeof ProductCodeSchema>;
export type ProductCategory = z.infer<typeof ProductCategorySchema>;
export type RecommendationReasonCode = z.infer<typeof RecommendationReasonCodeSchema>;

/**
 * Money type
 */
export interface Money {
  amount: number;
  currency: 'KRW';
}

/**
 * Image asset
 */
export interface ImageAsset {
  url: string;
  alt: string;
  width: number;
  height: number;
  aspectRatio: string;
}

/**
 * 3D model configuration
 */
export interface ModelVariant {
  key: string;
  label: string;
}

export interface Product3D {
  format: 'GLB' | 'GLTF';
  url: string;
  posterUrl: string;
  environmentImageUrl?: string | null;
  cameraOrbit: string;
  cameraTarget: string;
  fieldOfView: string;
  autoRotate: boolean;
  availableVariants: ModelVariant[];
}

/**
 * Product option
 */
export interface SelectOption {
  value: string;
  label: string;
  modelVariant?: string | null;
}

export interface OptionGroup {
  key: string;
  label: string;
  required: boolean;
  type: 'SELECT' | 'TEXT';
  options?: SelectOption[];
  maxLength?: number | null;
}

/**
 * Recommendation view
 */
export interface RecommendationView {
  eligible: boolean;
  score: number;
  reasonCodes: RecommendationReasonCode[];
}

/**
 * Product card (list view)
 */
export interface ProductCard {
  id: string;
  code: ProductCode;
  name: string;
  category: ProductCategory;
  mockPrice: Money;
  estimatedDuration: string;
  requiredAreaCm2: number;
  listImage: ImageAsset;
  has3d: boolean;
  recommendation: RecommendationView;
}

/**
 * Product detail (includes 3D)
 */
export interface ProductDetail extends ProductCard {
  description: string;
  dimensions: {
    widthMm: number;
    heightMm: number;
    depthMm: number;
  };
  model3d: Product3D | null;
  optionGroups: OptionGroup[];
}
