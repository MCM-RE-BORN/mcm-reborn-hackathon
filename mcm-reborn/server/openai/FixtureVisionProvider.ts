import { BagVisionResult } from '@/contracts/analysis';
import { readFileSync } from 'fs';
import { join } from 'path';

const mockData = JSON.parse(
  readFileSync(join(process.cwd(), '..', 'mock-data.json'), 'utf-8')
);

export interface AnalyzeInput {
  imageUrls: string[];
  demoScenarioKey?: string | null;
}

export interface AnalyzeResult {
  result: BagVisionResult;
  model: string;
  providerRequestId: string | null;
  modeUsed: 'FIXTURE';
}

/**
 * Fixture Vision Provider for demo scenarios
 * Returns pre-prepared analysis results from mock-data.json
 */
export class FixtureVisionProvider {
  async analyze(input: AnalyzeInput): Promise<AnalyzeResult> {
    const { demoScenarioKey } = input;

    // Find fixture by scenario key, default to first fixture
    type FixtureData = {
      scenarioKey?: string;
      analysisResult: BagVisionResult;
      provider?: { model?: string };
    };
    const fixtures = mockData.analysisFixtures as FixtureData[];
    const fixture = demoScenarioKey
      ? fixtures.find((f) => f.scenarioKey === demoScenarioKey)
      : fixtures[0];

    if (!fixture) {
      throw new Error(`Fixture not found for scenario: ${demoScenarioKey}`);
    }

    return {
      result: fixture.analysisResult,
      model: fixture.provider?.model ?? 'FIXTURE',
      providerRequestId: null,
      modeUsed: 'FIXTURE',
    };
  }
}
