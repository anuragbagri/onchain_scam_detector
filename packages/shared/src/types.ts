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

export interface TokenInfo {
  mintAddress: string;
  supply: number;
  decimals: number;
  mintAuthorityRevoked: boolean;
  freezeAuthorityRevoked: boolean;
  estimatedAgeDays: number | null;
  knownName?: string;
}

export interface WalletInfo {
  balanceSOL: number;
  tokenCount: number;
  transactionCount: number;
  estimatedAgeDays: number | null;
  knownName?: string;
}

export interface MLInsight {
  anomalyScore: number;       // 0–100 from autoencoder
  scamProbability: number;    // 0–100 from classifier
  combinedScore: number;      // weighted blend
  confidence: number;         // 0–1 model decisiveness
  topFeatures: { name: string; contribution: number }[];
  modelAvailable: boolean;
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
    lpHealth: CategoryScore;
    clusterRisk: CategoryScore;
  };
  mlInsight: MLInsight;
  confidence: number;
  tokenInfo?: TokenInfo;
  walletInfo?: WalletInfo;
  analyzedAt: string;
}
