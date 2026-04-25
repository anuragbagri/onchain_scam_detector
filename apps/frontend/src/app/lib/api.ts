import type { AnalysisResult, AnalysisMode } from '@shared/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function analyzeAddress(
  address: string,
  mode: AnalysisMode | 'auto'
): Promise<AnalysisResult> {
  const response = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address,
      mode: mode === 'auto' ? undefined : mode,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message =
      errorData?.error || `Analysis failed with status ${response.status}`;
    throw new Error(message);
  }

  return response.json();
}

