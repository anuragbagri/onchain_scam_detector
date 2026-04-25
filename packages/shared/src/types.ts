export type AnalysisMode = 'wallet' | 'token';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskSignal {
  label: string;
  severity: RiskLevel;
  value?: string;
  explorerUrl?: string;
}

export interface CategoryScore {
  name: string;
  score: number;
  level: RiskLevel;
  signals: RiskSignal[];
}

export interface AnalysisResult {
  address: string;
  mode: AnalysisMode;
  overallScore: number;
  overallLevel: RiskLevel;
  summary: string;
  categories: {
    rugPull: CategoryScore;
    fakeVolume: CategoryScore;
    suspiciousWallet: CategoryScore;
  };
  analyzedAt: string;
}
