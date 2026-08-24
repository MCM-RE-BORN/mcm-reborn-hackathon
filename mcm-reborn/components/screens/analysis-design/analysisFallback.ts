type AnalysisWarning = { code: string; message: string };

type AnalysisFallbackCandidate = {
  modeUsed: string;
  provider: { name: string };
  warnings: AnalysisWarning[];
};

export function isApiFallbackAnalysis(
  analysis: AnalysisFallbackCandidate,
): boolean {
  return (
    analysis.modeUsed === 'DEMO_FIXTURE' &&
    analysis.provider.name === 'DEMO_DATA' &&
    analysis.warnings.some(isProviderFallbackWarning)
  );
}

export function visibleAnalysisWarnings(
  analysis: AnalysisFallbackCandidate,
): AnalysisWarning[] {
  if (!isApiFallbackAnalysis(analysis)) {
    return [...analysis.warnings];
  }
  return analysis.warnings.filter(
    (warning) => !isProviderFallbackWarning(warning),
  );
}

function isProviderFallbackWarning(warning: AnalysisWarning): boolean {
  return warning.code.startsWith('AI_PROVIDER_');
}
