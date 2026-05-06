/**
 * Training Data Generator — produces labeled feature vectors
 * for both the autoencoder and binary classifier.
 *
 * Uses a combination of:
 * 1. Template-based patterns for known scam/legit archetypes
 * 2. Random noise augmentation for diversity
 */

import { FEATURE_DIM } from './featureExtractor';

export interface TrainingSample {
  features: number[];
  label: 0 | 1; // 0 = legit, 1 = scam
}

/**
 * Generate the full training dataset.
 * Returns ~500 samples (balanced legit/scam).
 */
export function generateTrainingData(): TrainingSample[] {
  const samples: TrainingSample[] = [];

  // ── Legitimate token patterns ────────────────────────────────
  const legitPatterns: Partial<Record<string, number>>[] = [
    // Established stablecoin (USDC-like)
    { mintAuthorityActive: 1, freezeAuthorityActive: 1, tokenAgeNorm: 0.95,
      supplyConcentrationTop10: 0.3, supplyConcentrationTop1: 0.1,
      txCount: 0.5, txFailureRate: 0.05, txVelocity: 0.3,
      timeSpanNorm: 0.9, timingUniformity: 0.2, burstRatio: 0.1,
      balanceSOLNorm: 0.5, balanceDrainRatio: 0, tokenHoldingsCount: 0.6,
      walletAgeNorm: 0.9, hasLPPool: 1, lpLocked: 1, isKnownAddress: 1 },

    // Mature DeFi token
    { mintAuthorityActive: 0, freezeAuthorityActive: 0, tokenAgeNorm: 0.7,
      supplyConcentrationTop10: 0.25, supplyConcentrationTop1: 0.08,
      txCount: 0.4, txFailureRate: 0.03, txVelocity: 0.15,
      timeSpanNorm: 0.8, timingUniformity: 0.3, burstRatio: 0.15,
      balanceSOLNorm: 0.3, balanceDrainRatio: 0, tokenHoldingsCount: 0.4,
      walletAgeNorm: 0.7, hasLPPool: 1, lpLocked: 1, isKnownAddress: 0 },

    // Community memecoin (established)
    { mintAuthorityActive: 0, freezeAuthorityActive: 0, tokenAgeNorm: 0.4,
      supplyConcentrationTop10: 0.35, supplyConcentrationTop1: 0.12,
      txCount: 0.6, txFailureRate: 0.08, txVelocity: 0.25,
      timeSpanNorm: 0.5, timingUniformity: 0.25, burstRatio: 0.2,
      balanceSOLNorm: 0.15, balanceDrainRatio: 0, tokenHoldingsCount: 0.2,
      walletAgeNorm: 0.5, hasLPPool: 1, lpLocked: 1, isKnownAddress: 0 },

    // Active DeFi protocol
    { mintAuthorityActive: 0, freezeAuthorityActive: 0, tokenAgeNorm: 0.6,
      supplyConcentrationTop10: 0.2, supplyConcentrationTop1: 0.05,
      txCount: 0.8, txFailureRate: 0.04, txVelocity: 0.4,
      timeSpanNorm: 0.7, timingUniformity: 0.15, burstRatio: 0.1,
      balanceSOLNorm: 0.8, balanceDrainRatio: 0, tokenHoldingsCount: 0.8,
      walletAgeNorm: 0.8, hasLPPool: 1, lpLocked: 1, isKnownAddress: 1 },

    // Normal user wallet
    { mintAuthorityActive: 0, freezeAuthorityActive: 0, tokenAgeNorm: 0.5,
      supplyConcentrationTop10: 0, supplyConcentrationTop1: 0,
      txCount: 0.2, txFailureRate: 0.02, txVelocity: 0.05,
      timeSpanNorm: 0.6, timingUniformity: 0.15, burstRatio: 0.05,
      balanceSOLNorm: 0.1, balanceDrainRatio: 0, tokenHoldingsCount: 0.15,
      walletAgeNorm: 0.6, hasLPPool: 0, lpLocked: 0, isKnownAddress: 0 },

    // Whale wallet
    { mintAuthorityActive: 0, freezeAuthorityActive: 0, tokenAgeNorm: 0.8,
      supplyConcentrationTop10: 0, supplyConcentrationTop1: 0,
      txCount: 0.5, txFailureRate: 0.01, txVelocity: 0.1,
      timeSpanNorm: 0.85, timingUniformity: 0.1, burstRatio: 0.05,
      balanceSOLNorm: 0.9, balanceDrainRatio: 0, tokenHoldingsCount: 0.7,
      walletAgeNorm: 0.85, hasLPPool: 0, lpLocked: 0, isKnownAddress: 0 },
  ];

  // ── Scam token patterns ──────────────────────────────────────
  const scamPatterns: Partial<Record<string, number>>[] = [
    // Classic rug pull: mint active, concentrated, new, no LP lock
    { mintAuthorityActive: 1, freezeAuthorityActive: 1, tokenAgeNorm: 0.02,
      supplyConcentrationTop10: 0.9, supplyConcentrationTop1: 0.6,
      txCount: 0.15, txFailureRate: 0.2, txVelocity: 0.8,
      timeSpanNorm: 0.05, timingUniformity: 0.7, burstRatio: 0.8,
      balanceSOLNorm: 0.02, balanceDrainRatio: 1, tokenHoldingsCount: 0.02,
      walletAgeNorm: 0.02, hasLPPool: 1, lpLocked: 0, isKnownAddress: 0 },

    // Honeypot: freeze active, can't sell
    { mintAuthorityActive: 0, freezeAuthorityActive: 1, tokenAgeNorm: 0.05,
      supplyConcentrationTop10: 0.7, supplyConcentrationTop1: 0.4,
      txCount: 0.3, txFailureRate: 0.4, txVelocity: 0.5,
      timeSpanNorm: 0.1, timingUniformity: 0.5, burstRatio: 0.6,
      balanceSOLNorm: 0.05, balanceDrainRatio: 0, tokenHoldingsCount: 0.05,
      walletAgeNorm: 0.05, hasLPPool: 1, lpLocked: 0, isKnownAddress: 0 },

    // Wash trading bot
    { mintAuthorityActive: 0, freezeAuthorityActive: 0, tokenAgeNorm: 0.1,
      supplyConcentrationTop10: 0.5, supplyConcentrationTop1: 0.2,
      txCount: 0.9, txFailureRate: 0.15, txVelocity: 0.95,
      timeSpanNorm: 0.08, timingUniformity: 0.85, burstRatio: 0.9,
      balanceSOLNorm: 0.01, balanceDrainRatio: 1, tokenHoldingsCount: 0.01,
      walletAgeNorm: 0.03, hasLPPool: 0, lpLocked: 0, isKnownAddress: 0 },

    // Pump and dump: brand new, high volume spike
    { mintAuthorityActive: 1, freezeAuthorityActive: 0, tokenAgeNorm: 0.01,
      supplyConcentrationTop10: 0.85, supplyConcentrationTop1: 0.5,
      txCount: 0.7, txFailureRate: 0.1, txVelocity: 0.9,
      timeSpanNorm: 0.02, timingUniformity: 0.6, burstRatio: 0.7,
      balanceSOLNorm: 0.03, balanceDrainRatio: 1, tokenHoldingsCount: 0.03,
      walletAgeNorm: 0.01, hasLPPool: 1, lpLocked: 0, isKnownAddress: 0 },

    // Sybil/bundled launch
    { mintAuthorityActive: 1, freezeAuthorityActive: 1, tokenAgeNorm: 0.03,
      supplyConcentrationTop10: 0.95, supplyConcentrationTop1: 0.3,
      txCount: 0.4, txFailureRate: 0.25, txVelocity: 0.7,
      timeSpanNorm: 0.06, timingUniformity: 0.75, burstRatio: 0.65,
      balanceSOLNorm: 0.01, balanceDrainRatio: 1, tokenHoldingsCount: 0.01,
      walletAgeNorm: 0.02, hasLPPool: 0, lpLocked: 0, isKnownAddress: 0 },

    // Drain wallet (stealer)
    { mintAuthorityActive: 0, freezeAuthorityActive: 0, tokenAgeNorm: 0.15,
      supplyConcentrationTop10: 0, supplyConcentrationTop1: 0,
      txCount: 0.6, txFailureRate: 0.35, txVelocity: 0.6,
      timeSpanNorm: 0.1, timingUniformity: 0.4, burstRatio: 0.5,
      balanceSOLNorm: 0.0, balanceDrainRatio: 1, tokenHoldingsCount: 0.0,
      walletAgeNorm: 0.05, hasLPPool: 0, lpLocked: 0, isKnownAddress: 0 },
  ];

  const featureKeys = [
    'mintAuthorityActive', 'freezeAuthorityActive', 'tokenAgeNorm',
    'supplyConcentrationTop10', 'supplyConcentrationTop1',
    'txCount', 'txFailureRate', 'txVelocity',
    'timeSpanNorm', 'timingUniformity', 'burstRatio',
    'balanceSOLNorm', 'balanceDrainRatio', 'tokenHoldingsCount',
    'walletAgeNorm', 'hasLPPool', 'lpLocked', 'isKnownAddress',
  ];

  // Convert pattern to feature vector
  function patternToFeatures(pattern: Partial<Record<string, number>>): number[] {
    return featureKeys.map(key => pattern[key] ?? 0);
  }

  // Augment with random noise
  function augment(features: number[], noiseLevel: number): number[] {
    return features.map(f => {
      const noise = (Math.random() - 0.5) * 2 * noiseLevel;
      return Math.max(0, Math.min(1, f + noise));
    });
  }

  // Generate augmented samples from each pattern
  const AUGMENT_COUNT = 40; // 40 augmented versions per template

  for (const pattern of legitPatterns) {
    const baseFeatures = patternToFeatures(pattern);
    samples.push({ features: baseFeatures, label: 0 });
    for (let i = 0; i < AUGMENT_COUNT; i++) {
      samples.push({ features: augment(baseFeatures, 0.08), label: 0 });
    }
  }

  for (const pattern of scamPatterns) {
    const baseFeatures = patternToFeatures(pattern);
    samples.push({ features: baseFeatures, label: 1 });
    for (let i = 0; i < AUGMENT_COUNT; i++) {
      samples.push({ features: augment(baseFeatures, 0.08), label: 1 });
    }
  }

  // Shuffle
  for (let i = samples.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [samples[i], samples[j]] = [samples[j], samples[i]];
  }

  console.log(`[Training] Generated ${samples.length} samples (${samples.filter(s => s.label === 0).length} legit, ${samples.filter(s => s.label === 1).length} scam)`);

  return samples;
}
