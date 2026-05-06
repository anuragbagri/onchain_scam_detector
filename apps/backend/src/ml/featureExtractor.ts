/**
 * Feature Extractor — converts raw on-chain data into a normalized
 * 18-dimensional feature vector for ML model consumption.
 *
 * All features are normalized to [0, 1] range.
 */

import type { SignatureInfo, TokenMetadata, WalletData } from '../services/dataFetcher';

export const FEATURE_NAMES = [
  'mintAuthorityActive',
  'freezeAuthorityActive',
  'tokenAgeNorm',
  'supplyConcentrationTop10',
  'supplyConcentrationTop1',
  'txCount',
  'txFailureRate',
  'txVelocity',
  'timeSpanNorm',
  'timingUniformity',
  'burstRatio',
  'balanceSOLNorm',
  'balanceDrainRatio',
  'tokenHoldingsCount',
  'walletAgeNorm',
  'hasLPPool',
  'lpLocked',
  'isKnownAddress',
] as const;

export const FEATURE_DIM = FEATURE_NAMES.length; // 18

export interface FeatureInput {
  signatures: SignatureInfo[];
  tokenMetadata: TokenMetadata | null;
  topHolders: { address: string; amount: number }[];
  walletData: WalletData;
  lpInfo?: { hasPool: boolean; isLocked: boolean } | null;
  isKnownAddress: boolean;
}

/**
 * Extract a normalized feature vector from on-chain data.
 * Returns an array of 18 numbers, each in [0, 1].
 */
export function extractFeatures(input: FeatureInput): number[] {
  const { signatures, tokenMetadata, topHolders, walletData, lpInfo, isKnownAddress } = input;

  // ── Authority features ──────────────────────────────────────
  const mintAuthorityActive = tokenMetadata ? (tokenMetadata.mintAuthorityRevoked ? 0 : 1) : 0.5;
  const freezeAuthorityActive = tokenMetadata ? (tokenMetadata.freezeAuthorityRevoked ? 0 : 1) : 0.5;

  // ── Token age (log-normalized, 1 year = 1.0) ───────────────
  const tokenAgeHours = tokenMetadata?.estimatedAgeHours ?? walletData.estimatedAgeHours ?? 0;
  const tokenAgeNorm = clamp(Math.log(tokenAgeHours + 1) / Math.log(8760)); // 8760h = 1yr

  // ── Supply concentration ────────────────────────────────────
  let supplyConcentrationTop10 = 0;
  let supplyConcentrationTop1 = 0;
  if (topHolders.length > 0 && tokenMetadata && tokenMetadata.supply > 0) {
    const totalSupply = tokenMetadata.supply;
    supplyConcentrationTop10 = clamp(
      topHolders.slice(0, 10).reduce((sum, h) => sum + h.amount, 0) / totalSupply
    );
    supplyConcentrationTop1 = clamp(topHolders[0].amount / totalSupply);
  }

  // ── Transaction features ────────────────────────────────────
  const txCount = clamp(signatures.length / 100);
  const failedTxs = signatures.filter(s => s.err).length;
  const txFailureRate = signatures.length > 0 ? clamp(failedTxs / signatures.length) : 0;

  // ── Timing features ─────────────────────────────────────────
  const blockTimes = signatures
    .map(s => s.blockTime)
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b);

  let txVelocity = 0;
  let timeSpanNorm = 0;
  let timingUniformity = 0;
  let burstRatio = 0;

  if (blockTimes.length > 2) {
    const totalTimeSpanHours = (blockTimes[blockTimes.length - 1] - blockTimes[0]) / 3600;
    timeSpanNorm = clamp(Math.log(totalTimeSpanHours + 1) / Math.log(720)); // 30d=1.0

    if (totalTimeSpanHours > 0) {
      txVelocity = clamp((signatures.length / totalTimeSpanHours) / 200);
    }

    // Compute timing uniformity (CoV of intervals)
    const intervals: number[] = [];
    for (let i = 1; i < blockTimes.length; i++) {
      intervals.push(blockTimes[i] - blockTimes[i - 1]);
    }

    if (intervals.length > 3) {
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      if (avgInterval > 0) {
        const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
        const stdDev = Math.sqrt(variance);
        const coeffOfVariation = stdDev / avgInterval;
        timingUniformity = clamp(1 - coeffOfVariation); // High uniformity = suspicious
      }

      // Burst ratio
      const shortGaps = intervals.filter(i => i < 30).length;
      burstRatio = clamp(shortGaps / intervals.length);
    }
  }

  // ── Balance features ────────────────────────────────────────
  const balanceSOLNorm = clamp(walletData.balanceSOL / 100);
  const balanceDrainRatio =
    walletData.balanceSOL < 0.01 && signatures.length > 10 ? 1 : 0;
  const tokenHoldingsCount = clamp(walletData.tokenAccounts.length / 50);

  // ── Wallet age (log-normalized) ─────────────────────────────
  const walletAgeHours = walletData.estimatedAgeHours ?? 0;
  const walletAgeNorm = clamp(Math.log(walletAgeHours + 1) / Math.log(8760));

  // ── LP features ─────────────────────────────────────────────
  const hasLPPool = lpInfo?.hasPool ? 1 : 0;
  const lpLocked = lpInfo?.isLocked ? 1 : 0;

  // ── Known address ───────────────────────────────────────────
  const knownAddr = isKnownAddress ? 1 : 0;

  return [
    mintAuthorityActive,
    freezeAuthorityActive,
    tokenAgeNorm,
    supplyConcentrationTop10,
    supplyConcentrationTop1,
    txCount,
    txFailureRate,
    txVelocity,
    timeSpanNorm,
    timingUniformity,
    burstRatio,
    balanceSOLNorm,
    balanceDrainRatio,
    tokenHoldingsCount,
    walletAgeNorm,
    hasLPPool,
    lpLocked,
    knownAddr,
  ];
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}
