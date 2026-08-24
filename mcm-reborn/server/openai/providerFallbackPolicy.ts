import type { VisionProviderFailureMetadata } from './openAiRequestPolicy';
import type { VisionAnalyzeInput } from './types';

export function canonicalFixtureFallbackInput(
  input: VisionAnalyzeInput,
): VisionAnalyzeInput {
  return { ...input, demoScenarioKey: null };
}

export function providerFallbackWarning(
  failure: VisionProviderFailureMetadata | null,
): { code: string; message: string } {
  if (failure?.kind === 'TIMEOUT' || failure?.kind === 'QUEUE_TIMEOUT') {
    return {
      code: 'AI_PROVIDER_TIMEOUT',
      message: '실제 AI 응답이 지연되어 준비된 데모 결과를 사용했습니다.',
    };
  }
  if (failure?.kind === 'RATE_LIMIT') {
    return {
      code: 'AI_PROVIDER_RATE_LIMIT',
      message: 'AI 서비스 사용량 제한으로 준비된 데모 결과를 사용했습니다.',
    };
  }
  if (failure?.kind === 'QUOTA_EXHAUSTED') {
    return {
      code: 'AI_PROVIDER_QUOTA_EXHAUSTED',
      message:
        'AI 서비스 크레딧 또는 프로젝트 사용 한도로 준비된 데모 결과를 사용했습니다.',
    };
  }
  return {
    code: 'AI_PROVIDER_ERROR',
    message: '실제 AI 분석 오류가 발생해 준비된 데모 결과를 사용했습니다.',
  };
}
