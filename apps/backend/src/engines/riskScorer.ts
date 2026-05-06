/**
 * Risk Scorer V2 — Ensemble scoring engine.
 *
 * Combines:
 * - 5 heuristic analyzers (rug pull, fake volume, wallet, LP health, cluster)
 * - ML scores (autoencoder anomaly + binary classifier)
 * - Mode-aware weights (token vs wallet)
 * - Confidence rating based on data quality
 */

import type { AnalysisResult, AnalysisMode, CategoryScore, RiskLevel, MLInsight } from '@shared/types';
import type { SignatureInfo, TokenMetadata, WalletData } from '../services/dataFetcher';
import { analyzeRugPull } from './rugPullAnalyzer';
import { analyzeFakeVolume } from './fakeVolumeAnalyzer';
import { analyzeWalletBehavior } from './walletAnalyzer';
import { analyzeLPHealth, type LPPoolInfo } from './lpHealthAnalyzer';
import { analyzeClusterRisk } from './clusterAnalyzer';
import { extractFeatures, type FeatureInput } from '../ml/featureExtractor';
import { computeMLScore, isMLReady } from '../ml/mlScorer';

// ── Mode-aware weights ─────────────────────────────────────────
const TOKEN_WEIGHTS = {
  mlScore:            0.25,
  rugPull:            0.20,
  lpHealth:           0.25,
  fakeVolume:         0.10,
  suspiciousWallet:   0.05,
  clusterRisk:        0.15,
};

const WALLET_WEIGHTS = {
  mlScore:            0.30,
  rugPull:            0.05,
  lpHealth:           0.00,
  fakeVolume:         0.20,
  suspiciousWallet:   0.30,
  clusterRisk:        0.15,
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
  lpInfo: LPPoolInfo;
  knownAddress?: KnownAddressInfo | null;
  isKnownHighActivity?: boolean;
}

/**
 * Run all analyzers + ML and produce the final AnalysisResult.
 */
export async function computeRiskScore(input: ScoringInput): Promise<AnalysisResult> {
  const {
    address,
    mode,
    signatures,
    tokenMetadata,
    topHolders,
    walletData,
    lpInfo,
    knownAddress,
    isKnownHighActivity: highActivity,
  } = input;

  // ── Run heuristic analyzers ─────────────────────────────────
  const rugPull = analyzeRugPull({ tokenMetadata, topHolders, signatures });
  const fakeVolume = analyzeFakeVolume({ signatures, targetAddress: address });
  const suspiciousWallet = analyzeWalletBehavior({ walletData, signatures });
  const lpHealth = analyzeLPHealth(lpInfo, mode === 'token');
  const clusterRisk = analyzeClusterRisk({
    topHolders,
    totalSupply: tokenMetadata?.supply ?? 0,
    signatures,
  });

  // ── Dampen for known high-activity addresses ────────────────
  if (highActivity && knownAddress) {
    fakeVolume.score = Math.round(fakeVolume.score * 0.3);
    fakeVolume.level = scoreToLevel(fakeVolume.score);
    suspiciousWallet.score = Math.round(suspiciousWallet.score * 0.4);
    suspiciousWallet.level = scoreToLevel(suspiciousWallet.score);

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

  // ── Run ML scoring ──────────────────────────────────────────
  const featureInput: FeatureInput = {
    signatures,
    tokenMetadata,
    topHolders,
    walletData,
    lpInfo: { hasPool: lpInfo.hasPool, isLocked: lpInfo.isLocked },
    isKnownAddress: !!knownAddress,
  };
  const features = extractFeatures(featureInput);
  const mlResult = await computeMLScore(features);

  const mlInsight: MLInsight = mlResult
    ? {
        anomalyScore: mlResult.anomalyScore,
        scamProbability: mlResult.scamProbability,
        combinedScore: mlResult.combinedMLScore,
        confidence: mlResult.confidence,
        topFeatures: mlResult.topFeatures,
        modelAvailable: true,
      }
    : {
        anomalyScore: 0,
        scamProbability: 0,
        combinedScore: 0,
        confidence: 0,
        topFeatures: [],
        modelAvailable: false,
      };

  // ── Compute weighted overall score ──────────────────────────
  const weights = mode === 'token' ? TOKEN_WEIGHTS : WALLET_WEIGHTS;
  const mlScore = mlInsight.modelAvailable ? mlInsight.combinedScore : 0;

  // If ML not available, redistribute its weight proportionally
  let effectiveWeights = { ...weights };
  if (!mlInsight.modelAvailable) {
    const mlWeight = effectiveWeights.mlScore;
    effectiveWeights.mlScore = 0;
    const remaining = 1 - mlWeight;
    for (const key of Object.keys(effectiveWeights) as Array<keyof typeof effectiveWeights>) {
      if (key !== 'mlScore' && effectiveWeights[key] > 0) {
        effectiveWeights[key] = effectiveWeights[key] / remaining;
      }
    }
  }

  const overallScore = Math.round(
    mlScore * effectiveWeights.mlScore +
    rugPull.score * effectiveWeights.rugPull +
    lpHealth.score * effectiveWeights.lpHealth +
    fakeVolume.score * effectiveWeights.fakeVolume +
    suspiciousWallet.score * effectiveWeights.suspiciousWallet +
    clusterRisk.score * effectiveWeights.clusterRisk
  );

  const overallLevel = computeOverallLevel(overallScore);

  // ── Confidence rating ───────────────────────────────────────
  const confidence = computeConfidence({
    hasTokenMetadata: !!tokenMetadata,
    hasLPData: lpInfo.hasPool,
    signaturesCount: signatures.length,
    mlAvailable: mlInsight.modelAvailable,
    hasTopHolders: topHolders.length > 0,
  });

  // ── Summary ─────────────────────────────────────────────────
  const summary = generateSummary(
    overallScore, overallLevel,
    rugPull, fakeVolume, suspiciousWallet, lpHealth, clusterRisk,
    mode, knownAddress, mlInsight
  );

  // ── Build metadata ──────────────────────────────────────────
  const tokenInfo = tokenMetadata
    ? {
        mintAddress: tokenMetadata.mintAddress,
        supply: tokenMetadata.supply,
        decimals: tokenMetadata.decimals,
        mintAuthorityRevoked: tokenMetadata.mintAuthorityRevoked,
        freezeAuthorityRevoked: tokenMetadata.freezeAuthorityRevoked,
        estimatedAgeDays: tokenMetadata.estimatedAgeHours
          ? tokenMetadata.estimatedAgeHours / 24
          : null,
        knownName: knownAddress?.name,
      }
    : undefined;

  const walletInfo = {
    balanceSOL: walletData.balanceSOL,
    tokenCount: walletData.tokenAccounts.length,
    transactionCount: signatures.length,
    estimatedAgeDays: walletData.estimatedAgeHours
      ? walletData.estimatedAgeHours / 24
      : null,
    knownName: knownAddress?.name,
  };

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
      lpHealth,
      clusterRisk,
    },
    mlInsight,
    confidence,
    tokenInfo,
    walletInfo,
    analyzedAt: new Date().toISOString(),
  };
}

// ── Helpers ──────────────────────────────────────────────────────

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

function computeConfidence(input: {
  hasTokenMetadata: boolean;
  hasLPData: boolean;
  signaturesCount: number;
  mlAvailable: boolean;
  hasTopHolders: boolean;
}): number {
  let confidence = 0;
  if (input.hasTokenMetadata) confidence += 0.2;
  if (input.hasLPData) confidence += 0.2;
  confidence += Math.min(0.2, (input.signaturesCount / 50) * 0.2);
  if (input.mlAvailable) confidence += 0.2;
  if (input.hasTopHolders) confidence += 0.2;
  return Math.round(confidence * 100) / 100;
}

function generateSummary(
  score: number,
  level: RiskLevel,
  rugPull: CategoryScore,
  fakeVolume: CategoryScore,
  suspiciousWallet: CategoryScore,
  lpHealth: CategoryScore,
  clusterRisk: CategoryScore,
  mode: AnalysisMode,
  knownAddress?: KnownAddressInfo | null,
  mlInsight?: MLInsight
): string {
  const target = mode === 'token' ? 'token' : 'wallet';
  const knownPrefix = knownAddress ? `[${knownAddress.name}] ` : '';
  const mlNote = mlInsight?.modelAvailable
    ? ` ML scam probability: ${mlInsight.scamProbability}%.`
    : '';

  if (level === 'high') {
    const highCategories: string[] = [];
    if (rugPull.level === 'high') highCategories.push('rug pull indicators');
    if (fakeVolume.level === 'high') highCategories.push('fake volume patterns');
    if (suspiciousWallet.level === 'high') highCategories.push('suspicious behavior');
    if (lpHealth.level === 'high') highCategories.push('liquidity risks');
    if (clusterRisk.level === 'high') highCategories.push('wallet clustering');

    return `${knownPrefix}⚠️ HIGH RISK: This ${target} shows significant ${highCategories.join(' and ')}.${mlNote} Overall risk score: ${score}/100. Exercise extreme caution.`;
  }

  if (level === 'medium') {
    const medCategories: string[] = [];
    if (rugPull.level !== 'low') medCategories.push('rug pull');
    if (fakeVolume.level !== 'low') medCategories.push('fake volume');
    if (suspiciousWallet.level !== 'low') medCategories.push('wallet behavior');
    if (lpHealth.level !== 'low') medCategories.push('liquidity');
    if (clusterRisk.level !== 'low') medCategories.push('clustering');

    return `${knownPrefix}⚡ MEDIUM RISK: This ${target} has some concerning signals in ${medCategories.join(', ')}.${mlNote} Overall risk score: ${score}/100. Proceed with caution.`;
  }

  return `${knownPrefix}✅ LOW RISK: This ${target} appears to have normal on-chain activity.${mlNote} Overall risk score: ${score}/100. No major red flags detected.`;
}
