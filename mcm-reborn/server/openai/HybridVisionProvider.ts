import { FixtureVisionProvider } from './FixtureVisionProvider';
import { OpenAiVisionProvider } from './OpenAiVisionProvider';
import {
  readProviderFailureMetadata,
} from './openAiRequestPolicy';
import {
  canonicalFixtureFallbackInput,
  providerFallbackWarning,
} from './providerFallbackPolicy';
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
      const fallback = await this.fixtureProvider.analyze(
        canonicalFixtureFallbackInput(input),
      );

      return {
        ...fallback,
        knowledgeTrace:
          error instanceof VisionWikiGroundingError
            ? error.knowledgeTrace
            : undefined,
        providerFailure: providerFailure ?? undefined,
        warnings: [providerFallbackWarning(providerFailure)],
      };
    }
  }
}

function safeProviderError(error: unknown): { name: string } {
  return {
    name: error instanceof Error ? error.name : 'UnknownProviderError',
  };
}
