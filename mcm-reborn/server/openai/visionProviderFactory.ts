import { OpenAiVisionProvider } from './OpenAiVisionProvider';
import { FixtureVisionProvider } from './FixtureVisionProvider';
import { HybridVisionProvider } from './HybridVisionProvider';

export type AiMode = 'live' | 'fixture' | 'hybrid';

/**
 * Factory to create appropriate vision provider based on AI_MODE
 */
export function createVisionProvider() {
  const mode = (process.env.AI_MODE ?? 'hybrid') as AiMode;

  switch (mode) {
    case 'live':
      return new OpenAiVisionProvider();
    case 'fixture':
      return new FixtureVisionProvider();
    case 'hybrid':
      return new HybridVisionProvider();
    default:
      console.warn(`Unknown AI_MODE: ${mode}, defaulting to hybrid`);
      return new HybridVisionProvider();
  }
}
