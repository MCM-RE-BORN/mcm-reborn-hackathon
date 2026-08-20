export const TEXTURE_PRIVACY_NOTICE_VERSION =
  "MCM_TEXTURE_AI_2026_08_21_R2" as const;

export const TEXTURE_PRIVACY_NOTICE_KO =
  "선택한 경우 촬영 사진에서 추출한 소재 이미지가 OpenAI 또는 Meshy로 전송되어 예상 텍스처와 3D 목업을 생성합니다. OpenAI API 콘텐츠는 기본 악용 모니터링을 위해 최대 30일, Meshy API 자산은 최대 3일 보관될 수 있으며, 중복 과금 방지를 위해 파생 결과 또는 작업 참조가 서비스 서버에 캐시됩니다. 결과는 주문 전 시각화이며 실제 재단 위치나 완성품을 보증하지 않습니다.";

export type ExternalTextureProvider = "MESHY" | "OPENAI";

export type TextureProviderCapabilities = {
  enabled: boolean;
  privacyNoticeVersion: typeof TEXTURE_PRIVACY_NOTICE_VERSION;
  providers: Record<ExternalTextureProvider, boolean>;
};

export type TexturePreviewCreateResponse =
  | {
      dataUrl: string;
      kind: "texture";
      mimeType: "image/jpeg";
      provider: "OPENAI";
    }
  | {
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
  kind: "task";
  modelUrl?: string;
  progress: number;
  provider: "MESHY";
  status: "canceled" | "failed" | "queued" | "running" | "succeeded";
  textureUrl?: string;
};
