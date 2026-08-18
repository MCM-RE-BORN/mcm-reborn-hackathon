import { z } from 'zod';

/**
 * Product codes and categories from OpenAPI
 */
export const ProductCodeSchema = z.enum([
  'REBORN_POUCH',
  'REBORN_CARD_WALLET',
  'REBORN_KEYRING',
  'REBORN_BAG_STRAP',
]);

export const ProductCategorySchema = z.enum([
  'CLUTCH_POUCH',
  'CARD_WALLET',
  'KEYRING',
  'BAG_STRAP',
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
  aspectRatio: '4:5';
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
  requiredAreaCm2: number;
  listImage: ImageAsset;
  has3d: true;
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
  model3d: Product3D;
  optionGroups: OptionGroup[];
}
