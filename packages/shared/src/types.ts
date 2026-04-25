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
  tokenInfo?: TokenInfo;
  walletInfo?: WalletInfo;
  analyzedAt: string;
}
