import {
  type ConditionGrade,
  type MaterialType,
  type SourceCategory,
} from '@/contracts/analysis';
import type { RecommendationReasonCode } from '@/contracts/product';

export interface RecommendationContext {
  conditionGrade: ConditionGrade;
  desiredUse: string;
  estimatedReusableAreaCm2: number;
  longStripAvailable: boolean;
  materialType: MaterialType;
  overallDamageSeverity: number;
  productCode: string;
  requiredAreaCm2: number;
}

/**
 * Base area estimates by source category (cm²)
 */
const BASE_AREA_BY_CATEGORY: Record<SourceCategory, number> = {
  BACKPACK: 4200,
  TOTE_SHOPPER: 3800,
  SHOULDER_CROSSBODY: 2500,
  BUCKET_BAG: 2800,
  TOP_HANDLE: 2600,
  BOSTON_BAG: 4500,
  CLUTCH_POUCH: 1300,
  BELT_BAG: 1200,
  WEEKENDER_DUFFLE: 5200,
  TRAVEL_LUGGAGE: 6500,
  UNKNOWN_BAG: 2200,
};

/**
 * Base reusable rate by condition grade
 */
const BASE_RATE_BY_GRADE: Record<ConditionGrade, number> = {
  A: 85,
  B: 70,
  C: 50,
  D: 25,
};

/**
 * Calculate reusable material rate and estimated area
 */
export function calculateReusableMaterial(
  sourceCategory: SourceCategory,
  conditionGrade: ConditionGrade,
  overallDamageSeverity: number
): {
  reusableMaterialRate: number;
  estimatedReusableAreaCm2: number;
} {
  const baseArea = BASE_AREA_BY_CATEGORY[sourceCategory];
  const baseRate = BASE_RATE_BY_GRADE[conditionGrade];

  // Apply damage penalty
  const damagePenalty = Math.min(overallDamageSeverity * 0.15, 15);
  const reusableMaterialRate = Math.max(15, Math.min(90, Math.round(baseRate - damagePenalty)));

  const estimatedReusableAreaCm2 = Math.round((baseArea * reusableMaterialRate) / 100);

  return {
    reusableMaterialRate,
    estimatedReusableAreaCm2,
  };
}

/**
 * Calculate recommendation score for a product
 */
export function calculateRecommendationScore(
  context: RecommendationContext,
): {
  eligible: boolean;
  score: number;
  reasonCodes: RecommendationReasonCode[];
} {
  const {
    conditionGrade,
    desiredUse,
    estimatedReusableAreaCm2,
    longStripAvailable,
    materialType,
    overallDamageSeverity,
    productCode,
    requiredAreaCm2,
  } = context;
  const eligible = estimatedReusableAreaCm2 >= requiredAreaCm2;
  const reasonCodes: RecommendationReasonCode[] = [];

  if (!eligible) {
    reasonCodes.push('INSUFFICIENT_AREA');
    return { eligible: false, score: 0, reasonCodes };
  }

  // Reusable area is the hard gate and the strongest ranking signal.
  const areaRatio = estimatedReusableAreaCm2 / requiredAreaCm2;
  const areaScore = Math.min(55, Math.round(areaRatio * 35));
  reasonCodes.push('SUFFICIENT_AREA');

  // Condition and visible damage indicate whether a clean panel can be cut.
  const conditionScores: Record<ConditionGrade, number> = {
    A: 24,
    B: 20,
    C: 12,
    D: 4,
  };
  const conditionScore = conditionScores[conditionGrade];
  const lowDamageRegionAvailable =
    overallDamageSeverity <= 35 && conditionGrade !== 'D';
  const lowDamageBonus = lowDamageRegionAvailable ? 6 : 0;

  if (lowDamageRegionAvailable) {
    reasonCodes.push('LOW_DAMAGE_REGION_AVAILABLE');
  }

  // Pattern-bearing coated canvas and leather benefit designs with broad faces.
  const patternVisible =
    (materialType === 'COATED_CANVAS' || materialType === 'LEATHER') &&
    overallDamageSeverity <= 50;
  const patternBonus = patternVisible ? 7 : 0;
  if (patternVisible) {
    reasonCodes.push('PATTERN_VISIBILITY');
  }

  // Small products and a usable strip consume shapes that larger designs cannot.
  let remnantBonus = 0;
  if (productCode === 'REBORN_KEYRING' || productCode === 'REBORN_NAME_TAG') {
    remnantBonus = 5;
    reasonCodes.push('USES_SMALL_REMNANTS');
  }
  if (productCode === 'REBORN_NAME_TAG' && longStripAvailable) {
    remnantBonus += 4;
    reasonCodes.push('LONG_STRIP_AVAILABLE');
  }

  // The customer's stated goal is a preference boost, never an eligibility gate.
  const preferenceBonus = desiredUseMatchesProduct(desiredUse, productCode) ? 8 : 0;

  const score = Math.min(
    100,
    areaScore +
      conditionScore +
      lowDamageBonus +
      patternBonus +
      remnantBonus +
      preferenceBonus,
  );

  return { eligible, score, reasonCodes };
}

function desiredUseMatchesProduct(
  desiredUse: string,
  productCode: string,
): boolean {
  const normalized = desiredUse.replace(/\s+/g, '').toLowerCase();
  const keywords: Record<string, readonly string[]> = {
    REBORN_CARD_WALLET: ['카드지갑', 'cardwallet'],
    REBORN_KEYRING: ['키링', 'keyring'],
    REBORN_NAME_TAG: ['네임택', '러기지택', 'luggagetag', 'nametag'],
    REBORN_PASSPORT_WALLET: ['여권지갑', 'passportwallet'],
  };

  return (keywords[productCode] ?? []).some((keyword) =>
    normalized.includes(keyword)
  );
}

/**
 * Calculate estimated carbon saving (demo formula)
 */
export function calculateCarbonSaving(estimatedReusableAreaCm2: number): number {
  return Math.round(estimatedReusableAreaCm2 * 0.0012 * 100) / 100;
}
