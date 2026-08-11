export type SourceCategory =
  | 'BACKPACK'
  | 'TOTE_SHOPPER'
  | 'SHOULDER_CROSSBODY'
  | 'BUCKET_BAG'
  | 'TOP_HANDLE'
  | 'BOSTON_BAG'
  | 'CLUTCH_POUCH'
  | 'BELT_BAG'
  | 'WEEKENDER_DUFFLE'
  | 'TRAVEL_LUGGAGE'
  | 'UNKNOWN_BAG';

export type ConditionGrade = 'A' | 'B' | 'C' | 'D';

export type ProductTemplate = {
  id: string;
  code: 'REBORN_POUCH' | 'REBORN_CARD_WALLET' | 'REBORN_KEYRING' | 'REBORN_BAG_STRAP';
  requiredAreaCm2: number;
  requiresLongStrip?: boolean;
};

const BASE_AREA_CM2: Record<SourceCategory, number> = {
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

const BASE_REUSABLE_RATE: Record<ConditionGrade, number> = {
  A: 85,
  B: 70,
  C: 50,
  D: 25,
};

const CONDITION_SCORE: Record<ConditionGrade, number> = {
  A: 30,
  B: 25,
  C: 18,
  D: 8,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function calculateMaterial(input: {
  sourceCategory: SourceCategory;
  conditionGrade: ConditionGrade;
  overallDamageSeverity: number;
}) {
  if (
    !Number.isInteger(input.overallDamageSeverity) ||
    input.overallDamageSeverity < 0 ||
    input.overallDamageSeverity > 100
  ) {
    throw new Error('DAMAGE_SEVERITY_OUT_OF_RANGE');
  }

  const damagePenalty = Math.min(input.overallDamageSeverity * 0.15, 15);
  const reusableMaterialRate = clamp(
    Math.round(BASE_REUSABLE_RATE[input.conditionGrade] - damagePenalty),
    15,
    90,
  );
  const estimatedReusableAreaCm2 = Math.round(
    BASE_AREA_CM2[input.sourceCategory] * reusableMaterialRate / 100,
  );
  const estimatedCarbonSavingKgCo2e = Number(
    (estimatedReusableAreaCm2 * 0.0012).toFixed(2),
  );

  return {
    reusableMaterialRate,
    estimatedReusableAreaCm2,
    estimatedCarbonSavingKgCo2e,
    methodologyVersion: 'DEMO_LCA_V1' as const,
  };
}

export function recommendProducts(input: {
  products: readonly ProductTemplate[];
  estimatedReusableAreaCm2: number;
  conditionGrade: ConditionGrade;
  longStripAvailable: boolean;
}) {
  return input.products
    .map((product) => {
      const areaEligible = input.estimatedReusableAreaCm2 >= product.requiredAreaCm2;
      const stripEligible = !product.requiresLongStrip || input.longStripAvailable;
      const eligible = areaEligible && stripEligible;

      const areaRatio = input.estimatedReusableAreaCm2 / product.requiredAreaCm2;
      const areaScore = Math.min(60, Math.round(areaRatio * 40));
      const remnantBonus = product.code === 'REBORN_KEYRING' ? 10 : 0;
      const score = clamp(
        areaScore + CONDITION_SCORE[input.conditionGrade] + remnantBonus,
        0,
        100,
      );

      const reasonCodes: string[] = [];
      if (areaEligible) reasonCodes.push('SUFFICIENT_AREA');
      else reasonCodes.push('INSUFFICIENT_AREA');
      if (product.code === 'REBORN_KEYRING') reasonCodes.push('USES_SMALL_REMNANTS');
      if (product.requiresLongStrip && input.longStripAvailable) {
        reasonCodes.push('LONG_STRIP_AVAILABLE');
      }

      return {
        productId: product.id,
        productCode: product.code,
        eligible,
        score,
        reasonCodes,
      };
    })
    .sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      return b.score - a.score;
    });
}
