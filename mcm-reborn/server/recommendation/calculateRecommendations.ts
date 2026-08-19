import { SourceCategory, ConditionGrade } from '@/contracts/analysis';
import { RecommendationReasonCode } from '@/contracts/product';

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
  estimatedReusableAreaCm2: number,
  requiredAreaCm2: number,
  conditionGrade: ConditionGrade,
  productCode: string
): {
  eligible: boolean;
  score: number;
  reasonCodes: RecommendationReasonCode[];
} {
  const eligible = estimatedReusableAreaCm2 >= requiredAreaCm2;
  const reasonCodes: RecommendationReasonCode[] = [];

  if (!eligible) {
    reasonCodes.push('INSUFFICIENT_AREA');
    return { eligible: false, score: 0, reasonCodes };
  }

  // Area score: up to 40 points
  const areaRatio = estimatedReusableAreaCm2 / requiredAreaCm2;
  const areaScore = Math.min(60, Math.round(areaRatio * 40));

  if (areaRatio >= 2.5) {
    reasonCodes.push('SUFFICIENT_AREA');
  }

  // Condition score
  const conditionScores: Record<ConditionGrade, number> = {
    A: 30,
    B: 25,
    C: 18,
    D: 8,
  };
  const conditionScore = conditionScores[conditionGrade];

  if (conditionGrade === 'A' || conditionGrade === 'B') {
    reasonCodes.push('PATTERN_VISIBILITY');
    reasonCodes.push('LOW_DAMAGE_REGION_AVAILABLE');
  }

  // Keyring bonus
  let remnantBonus = 0;
  if (productCode === 'REBORN_KEYRING') {
    remnantBonus = 10;
    reasonCodes.push('USES_SMALL_REMNANTS');
  }

  const score = Math.min(100, areaScore + conditionScore + remnantBonus);

  return { eligible, score, reasonCodes };
}

/**
 * Calculate estimated carbon saving (demo formula)
 */
export function calculateCarbonSaving(estimatedReusableAreaCm2: number): number {
  return Math.round(estimatedReusableAreaCm2 * 0.0012 * 100) / 100;
}
