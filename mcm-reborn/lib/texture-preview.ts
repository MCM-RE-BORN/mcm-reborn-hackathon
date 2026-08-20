export const TEXTURE_PRIVACY_NOTICE_VERSION =
  "MCM_TEXTURE_AI_2026_08_21_R3" as const;

export const TEXTURE_PRIVACY_NOTICE_KO =
  "선택한 경우 등록한 제품의 외관 사진 최대 4장이 OpenAI와 Meshy로 전송되어 외관 부위를 분류하고 참고용 원제품 3D/PBR 및 여권 지갑용 UV 텍스처를 생성합니다. 안감은 처리하지 않습니다. OpenAI API 콘텐츠는 기본 악용 모니터링을 위해 최대 30일, Meshy API 자산은 최대 3일 보관될 수 있으며, 중복 과금 방지를 위해 파생 결과 또는 작업 참조가 서비스 서버에 캐시됩니다. 결과는 주문 전 시각화이며 실제 재단 위치나 완성품을 보증하지 않습니다.";

export type ExternalTextureProvider = "MESHY" | "OPENAI";
export type MeshyTaskKind = "SOURCE_MODEL" | "TARGET_RETEXTURE";
export type TextureJobKind = "EXTERIOR_PLAN" | MeshyTaskKind;
export type ExteriorPart = "BODY" | "TRIM" | "STRAP" | "HARDWARE";
export type ExteriorView = "FRONT" | "RIGHT" | "REAR" | "LEFT";

export type ExteriorMaterialPart = {
  appearance: {
    colors: string[];
    finishDescription: string | null;
    materialFamily: string | null;
    patternDescription: string | null;
  };
  confidence: number;
  evidenceViews: ExteriorView[];
  observation: "PRESENT" | "NOT_OBSERVED" | "UNCERTAIN";
  part: ExteriorPart;
  semanticMask: {
    reason: "MESHY_DOES_NOT_RETURN_SEMANTIC_MASK";
    status: "UNAVAILABLE";
  };
  transferMode:
    | "GENERATE_SWATCH"
    | "KEEP_TARGET_PBR"
    | "OMIT_FROM_PASSPORT_WALLET";
};

export type ExteriorMaterialPlan = {
  parts: ExteriorMaterialPart[];
  schemaVersion: "MCM_EXTERIOR_MATERIAL_PLAN_V1";
  sourceEvidence: "PHOTOS";
  warnings: string[];
};

export type TextureProviderCapabilities = {
  enabled: boolean;
  features: {
    exteriorPlan: boolean;
    sourceModel: boolean;
    targetRetexture: boolean;
  };
  privacyNoticeVersion: typeof TEXTURE_PRIVACY_NOTICE_VERSION;
  providers: Record<ExternalTextureProvider, boolean>;
};

export type TexturePreviewCreateResponse =
  | {
      jobKind: "EXTERIOR_PLAN";
      kind: "plan";
      plan: ExteriorMaterialPlan;
      provider: "OPENAI";
    }
  | {
      jobKind: MeshyTaskKind;
      kind: "task";
      progress: number;
      provider: "MESHY";
      status: "queued";
      taskToken: string;
    };

export type MeshyTextureTaskResponse = {
  consumedCredits?: number;
  errorMessage?: string;
  expiresAt?: string;
  jobKind: MeshyTaskKind;
  kind: "task";
  modelUrl?: string;
  pbr?: {
    baseColorUrl?: string;
    metallicUrl?: string;
    normalUrl?: string;
    roughnessUrl?: string;
  };
  progress: number;
  provider: "MESHY";
  status: "canceled" | "failed" | "queued" | "running" | "succeeded";
  textureUrl?: string;
  usage: "REFERENCE_ONLY" | "TARGET_PREVIEW";
};
