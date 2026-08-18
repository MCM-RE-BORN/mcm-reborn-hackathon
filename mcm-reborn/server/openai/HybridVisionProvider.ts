import { OpenAiVisionProvider, AnalyzeInput } from './OpenAiVisionProvider';
import { FixtureVisionProvider } from './FixtureVisionProvider';
import { ImageQualityInsufficientError } from '@/contracts/errors';
import { BagVisionResult } from '@/contracts/analysis';

type HybridAnalyzeResult = {
  result: BagVisionResult;
  model: string;
  providerRequestId: string | null;
  modeUsed: 'LIVE' | 'FIXTURE' | 'FIXTURE_FALLBACK';
  warnings?: Array<{ code: string; message: string }>;
};

/**
 * Hybrid Vision Provider
 * Attempts OpenAI first, falls back to Fixture on error
 *
 * IMPORTANT: ImageQualityInsufficientError is NOT a provider failure,
 * so it must not trigger fallback to fixture success.
 */
export class HybridVisionProvider {
  private openAiProvider: OpenAiVisionProvider;
  private fixtureProvider: FixtureVisionProvider;

  constructor() {
    this.openAiProvider = new OpenAiVisionProvider();
    this.fixtureProvider = new FixtureVisionProvider();
  }

  async analyze(input: AnalyzeInput): Promise<HybridAnalyzeResult> {
    try {
      // Try OpenAI first
      return await this.openAiProvider.analyze(input);
    } catch (error) {
      // Image quality errors should NOT fallback to fixture
      if (error instanceof ImageQualityInsufficientError) {
        throw error;
      }

      // Log provider error
      console.warn('[HybridVisionProvider] OpenAI failed, falling back to fixture', error);

      // Fall back to fixture
      const fallbackResult = await this.fixtureProvider.analyze(input);

      return {
        ...fallbackResult,
        modeUsed: 'FIXTURE_FALLBACK' as const,
        warnings: [
          {
            code: this.getWarningCode(error),
            message: this.getWarningMessage(error),
          },
        ],
      };
    }
  }

  private getWarningCode(error: unknown): string {
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        return 'AI_PROVIDER_TIMEOUT';
      }
      if (error.message.includes('rate limit')) {
        return 'AI_PROVIDER_RATE_LIMIT';
      }
    }
    return 'AI_PROVIDER_ERROR';
  }

  private getWarningMessage(error: unknown): string {
    const code = this.getWarningCode(error);

    if (code === 'AI_PROVIDER_TIMEOUT') {
      return '실제 AI 응답이 지연되어 준비된 데모 결과를 사용했습니다.';
    }
    if (code === 'AI_PROVIDER_RATE_LIMIT') {
      return 'AI 서비스 사용량 제한으로 준비된 데모 결과를 사용했습니다.';
    }
    return '실제 AI 분석 오류가 발생해 준비된 데모 결과를 사용했습니다.';
  }
}
