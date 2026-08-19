import { FixtureVisionProvider } from './FixtureVisionProvider';
import { OpenAiVisionProvider } from './OpenAiVisionProvider';
import type {
  VisionAnalyzeInput,
  VisionAnalyzeResult,
  VisionProvider,
} from './types';
import { VisionImageQualityError } from './types';

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

      console.warn(
        '[HybridVisionProvider] OpenAI failed; using canonical fixture',
        safeProviderError(error),
      );
      const fallback = await this.fixtureProvider.analyze(input);

      return {
        ...fallback,
        warnings: [
          {
            code: warningCode(error),
            message: warningMessage(error),
          },
        ],
      };
    }
  }
}

function warningCode(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('timeout') || message.includes('etimedout')) {
    return 'AI_PROVIDER_TIMEOUT';
  }
  if (message.includes('rate limit')) {
    return 'AI_PROVIDER_RATE_LIMIT';
  }
  return 'AI_PROVIDER_ERROR';
}

function warningMessage(error: unknown): string {
  const code = warningCode(error);
  if (code === 'AI_PROVIDER_TIMEOUT') {
    return '실제 AI 응답이 지연되어 준비된 데모 결과를 사용했습니다.';
  }
  if (code === 'AI_PROVIDER_RATE_LIMIT') {
    return 'AI 서비스 사용량 제한으로 준비된 데모 결과를 사용했습니다.';
  }
  return '실제 AI 분석 오류가 발생해 준비된 데모 결과를 사용했습니다.';
}

function safeProviderError(error: unknown): string {
  return error instanceof Error ? error.name : 'Unknown provider error';
}
