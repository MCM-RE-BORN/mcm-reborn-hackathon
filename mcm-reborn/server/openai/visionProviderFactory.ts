import { FixtureVisionProvider } from './FixtureVisionProvider';
import { HybridVisionProvider } from './HybridVisionProvider';
import { ServiceUnavailableError } from '@/contracts/errors';
import type { VisionProvider } from './types';

/** Create the provider selected by the v2 analysis mode configuration. */
export function createVisionProvider(): VisionProvider {
  const mode = (process.env.AI_MODE ?? 'DEMO_FIXTURE').toUpperCase();

  switch (mode) {
    case 'DEMO_FIXTURE':
      return new FixtureVisionProvider('DEMO_FIXTURE');
    case 'SEEDED_ESTIMATE':
      return new FixtureVisionProvider('SEEDED_ESTIMATE');
    case 'LIVE':
      assertExternalAiReady();
      return new HybridVisionProvider();
    default:
      throw new Error(`Unsupported AI_MODE: ${mode}`);
  }
}

/**
 * LIVE may send private source images to an external processor, so it is
 * deliberately unavailable until the deployment opts in and pins the privacy
 * notice shown to the customer. The request-level consent is checked by the
 * analysis service before signed image URLs are created.
 */
export function assertExternalAiReady(): void {
  const ready =
    process.env.ENABLE_EXTERNAL_AI === 'true' &&
    Boolean(process.env.EXTERNAL_AI_PRIVACY_NOTICE_VERSION?.trim()) &&
    Boolean(process.env.OPENAI_API_KEY?.trim()) &&
    Boolean(process.env.OPENAI_VISION_MODEL?.trim());

  if (!ready) {
    throw new ServiceUnavailableError(
      'External AI analysis is not enabled for this deployment',
    );
  }
}
