import { FixtureVisionProvider } from './FixtureVisionProvider';
import { OpenAiVisionProvider } from './OpenAiVisionProvider';
import {
  readProviderFailureMetadata,
  type VisionProviderFailureMetadata,
} from './openAiRequestPolicy';
import type {
  VisionAnalyzeInput,
  VisionAnalyzeResult,
  VisionProvider,
} from './types';
import { VisionImageQualityError, VisionWikiGroundingError } from './types';

/**
 * Compatibility mode for deployments that explicitly opt into provider
 * fallback. Image-quality failures remain user-input errors and never become a
 * successful fixture analysis.
 */
export class HybridVisionProvider implements VisionProvider {
  private readonly openAiProvider = new OpenAiVisionProvider();
  private readonly fixtureProvider = new FixtureVisionProvider();

  async analyze(input: VisionAnalyzeInput): Promise<VisionAnalyzeResult> {
    try {
      return await this.openAiProvider.analyze(input);
    } catch (error) {
      if (error instanceof VisionImageQualityError) {
        throw error;
      }

      const providerFailure = readProviderFailureMetadata(error);
      console.warn(
        '[HybridVisionProvider] OpenAI failed; using canonical fixture',
        providerFailure ?? safeProviderError(error),
      );
      const fallback = await this.fixtureProvider.analyze(input);

      return {
        ...fallback,
        knowledgeTrace:
          error instanceof VisionWikiGroundingError
            ? error.knowledgeTrace
            : undefined,
        providerFailure: providerFailure ?? undefined,
        warnings: [
          {
            code: warningCode(providerFailure),
            message: warningMessage(providerFailure),
          },
        ],
      };
    }
  }
}

function warningCode(
  failure: VisionProviderFailureMetadata | null,
): string {
  if (
    failure?.kind === 'TIMEOUT' ||
    failure?.kind === 'QUEUE_TIMEOUT'
  ) {
    return 'AI_PROVIDER_TIMEOUT';
  }
  if (failure?.kind === 'RATE_LIMIT') {
    return 'AI_PROVIDER_RATE_LIMIT';
  }
  if (failure?.kind === 'QUOTA_EXHAUSTED') {
    return 'AI_PROVIDER_QUOTA_EXHAUSTED';
  }
  return 'AI_PROVIDER_ERROR';
}

function warningMessage(
  failure: VisionProviderFailureMetadata | null,
): string {
  const code = warningCode(failure);
  if (code === 'AI_PROVIDER_TIMEOUT') {
    return '실제 AI 응답이 지연되어 준비된 데모 결과를 사용했습니다.';
  }
  if (code === 'AI_PROVIDER_RATE_LIMIT') {
    return 'AI 서비스 사용량 제한으로 준비된 데모 결과를 사용했습니다.';
  }
  if (code === 'AI_PROVIDER_QUOTA_EXHAUSTED') {
    return 'AI 서비스 크레딧 또는 프로젝트 사용 한도로 준비된 데모 결과를 사용했습니다.';
  }
  return '실제 AI 분석 오류가 발생해 준비된 데모 결과를 사용했습니다.';
}

function safeProviderError(error: unknown): { name: string } {
  return {
    name: error instanceof Error ? error.name : 'UnknownProviderError',
  };
}
