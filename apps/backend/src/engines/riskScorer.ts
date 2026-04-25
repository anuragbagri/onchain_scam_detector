import type { AnalysisResult, AnalysisMode, CategoryScore, RiskLevel } from '@shared/types';
import type { SignatureInfo, TokenMetadata, WalletData } from '../services/dataFetcher';
import { analyzeRugPull } from './rugPullAnalyzer';
import { analyzeFakeVolume } from './fakeVolumeAnalyzer';
import { analyzeWalletBehavior } from './walletAnalyzer';

// Category weights for overall score
const WEIGHTS = {
  rugPull: 0.4,
  fakeVolume: 0.3,
  suspiciousWallet: 0.3,
};

interface KnownAddressInfo {
  name: string;
  type: string;
  description: string;
}

interface ScoringInput {
  address: string;
  mode: AnalysisMode;
  signatures: SignatureInfo[];
  tokenMetadata: TokenMetadata | null;
  topHolders: { address: string; amount: number }[];
  walletData: WalletData;
  knownAddress?: KnownAddressInfo | null;
  isKnownHighActivity?: boolean;
}

/**
 * Run all analyzers and produce a complete AnalysisResult.
 * If the address is a known high-activity address (DEX, protocol, etc.),
 * velocity/timing scores are dampened to avoid false positives.
 */
export function computeRiskScore(input: ScoringInput): AnalysisResult {
  const {
    address,
    mode,
    signatures,
    tokenMetadata,
    topHolders,
    walletData,
    knownAddress,
    isKnownHighActivity: highActivity,
  } = input;

  // Run each analyzer
  const rugPull = analyzeRugPull({ tokenMetadata, topHolders, signatures });
  const fakeVolume = analyzeFakeVolume({ signatures, targetAddress: address });
  const suspiciousWallet = analyzeWalletBehavior({ walletData, signatures });

  // Dampen scores for known high-activity addresses
  if (highActivity && knownAddress) {
    // Halve the velocity-based scores for known protocols
    fakeVolume.score = Math.round(fakeVolume.score * 0.3);
    fakeVolume.level = scoreToLevel(fakeVolume.score);
    suspiciousWallet.score = Math.round(suspiciousWallet.score * 0.4);
    suspiciousWallet.level = scoreToLevel(suspiciousWallet.score);

    // Add informational signal at the top
    fakeVolume.signals.unshift({
      label: `Known address: ${knownAddress.name} — ${knownAddress.description}`,
      severity: 'low',
      value: `High activity is expected for this ${knownAddress.type}`,
    });
    suspiciousWallet.signals.unshift({
      label: `Known address: ${knownAddress.name} — velocity signals dampened`,
      severity: 'low',
      value: 'Well-known protocol',
    });
  }

  // Compute weighted overall score
  const overallScore = Math.round(
    rugPull.score * WEIGHTS.rugPull +
      fakeVolume.score * WEIGHTS.fakeVolume +
      suspiciousWallet.score * WEIGHTS.suspiciousWallet
  );

  const overallLevel = computeOverallLevel(overallScore);
  const summary = generateSummary(overallScore, overallLevel, rugPull, fakeVolume, suspiciousWallet, mode, knownAddress);

  return {
    address,
    mode,
    overallScore,
    overallLevel,
    summary,
    categories: {
      rugPull,
      fakeVolume,
      suspiciousWallet,
    },
    analyzedAt: new Date().toISOString(),
  };
}

function scoreToLevel(score: number): RiskLevel {
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

function computeOverallLevel(score: number): RiskLevel {
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

function generateSummary(
  score: number,
  level: RiskLevel,
  rugPull: CategoryScore,
  fakeVolume: CategoryScore,
  suspiciousWallet: CategoryScore,
  mode: AnalysisMode,
  knownAddress?: KnownAddressInfo | null
): string {
  const target = mode === 'token' ? 'token' : 'wallet';
  const knownPrefix = knownAddress ? `[${knownAddress.name}] ` : '';

  if (level === 'high') {
    const highCategories: string[] = [];
    if (rugPull.level === 'high') highCategories.push('rug pull indicators');
    if (fakeVolume.level === 'high') highCategories.push('fake volume patterns');
    if (suspiciousWallet.level === 'high') highCategories.push('suspicious behavior');

    return `${knownPrefix}⚠️ HIGH RISK: This ${target} shows significant ${highCategories.join(
      ' and '
    )}. Overall risk score: ${score}/100. Exercise extreme caution.`;
  }

  if (level === 'medium') {
    const medCategories: string[] = [];
    if (rugPull.level !== 'low') medCategories.push('rug pull');
    if (fakeVolume.level !== 'low') medCategories.push('fake volume');
    if (suspiciousWallet.level !== 'low') medCategories.push('wallet behavior');

    return `${knownPrefix}⚡ MEDIUM RISK: This ${target} has some concerning signals in ${medCategories.join(
      ', '
    )}. Overall risk score: ${score}/100. Proceed with caution.`;
  }

  return `${knownPrefix}✅ LOW RISK: This ${target} appears to have normal on-chain activity. Overall risk score: ${score}/100. No major red flags detected.`;
}

