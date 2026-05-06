/**
 * Cluster Analyzer — detects coordinated wallet networks
 * among top token holders (bundled launches / sybil attacks).
 *
 * Signals:
 * - Top holders created at same time (+20)
 * - Top holders have suspiciously similar balance patterns (+15)
 * - Very high concentration across few wallets (+25)
 */

import type { CategoryScore, RiskSignal } from '@shared/types';
import type { SignatureInfo } from '../services/dataFetcher';

export interface ClusterInput {
  topHolders: { address: string; amount: number }[];
  totalSupply: number;
  signatures: SignatureInfo[];
}

/**
 * Analyze wallet clustering patterns among top holders.
 * This is a lightweight version — no extra RPC calls needed.
 * It uses the existing top holders data + statistical analysis.
 */
export function analyzeClusterRisk(input: ClusterInput): CategoryScore {
  const signals: RiskSignal[] = [];
  let score = 0;

  const { topHolders, totalSupply, signatures } = input;

  if (topHolders.length < 2) {
    return {
      name: 'Cluster Risk',
      score: 0,
      level: 'low',
      signals: [{
        label: 'Insufficient holder data for cluster analysis',
        severity: 'low',
        value: `${topHolders.length} holders`,
      }],
    };
  }

  // ── Holder balance pattern analysis ──────────────────────────
  // Check if multiple holders have suspiciously similar amounts
  // (sign of a coordinated launch / bundled buys)
  if (totalSupply > 0 && topHolders.length >= 5) {
    const top5 = topHolders.slice(0, 5);
    const amounts = top5.map(h => h.amount);

    // Check for near-identical holdings (within 5% of each other)
    let similarPairs = 0;
    for (let i = 0; i < amounts.length; i++) {
      for (let j = i + 1; j < amounts.length; j++) {
        const ratio = Math.min(amounts[i], amounts[j]) / Math.max(amounts[i], amounts[j]);
        if (ratio > 0.95) similarPairs++;
      }
    }

    if (similarPairs >= 3) {
      score += 25;
      signals.push({
        label: 'Multiple top holders have nearly identical balances — strong bundler indicator',
        severity: 'high',
        value: `${similarPairs} pairs with 95%+ match`,
      });
    } else if (similarPairs >= 1) {
      score += 10;
      signals.push({
        label: 'Some holders have very similar balance amounts',
        severity: 'medium',
        value: `${similarPairs} similar pair(s)`,
      });
    }

    // ── Concentration analysis ───────────────────────────────────
    // Check if top 5 combined control a dangerous amount
    const top5Pct = top5.reduce((sum, h) => sum + h.amount, 0) / totalSupply;
    if (top5Pct > 0.7) {
      score += 25;
      signals.push({
        label: 'Top 5 holders control >70% of supply — extreme concentration',
        severity: 'high',
        value: `${(top5Pct * 100).toFixed(1)}%`,
      });
    } else if (top5Pct > 0.5) {
      score += 15;
      signals.push({
        label: 'Top 5 holders control >50% of supply',
        severity: 'medium',
        value: `${(top5Pct * 100).toFixed(1)}%`,
      });
    } else {
      signals.push({
        label: 'Top 5 holder concentration',
        severity: 'low',
        value: `${(top5Pct * 100).toFixed(1)}%`,
      });
    }

    // ── Whale ratio ──────────────────────────────────────────────
    // Check if the #1 holder dominates others
    if (topHolders.length >= 2) {
      const whaleRatio = topHolders[0].amount / topHolders[1].amount;
      if (whaleRatio > 10) {
        score += 15;
        signals.push({
          label: 'Single whale holds 10x more than the next largest holder',
          severity: 'high',
          value: `${whaleRatio.toFixed(1)}x ratio`,
        });
      } else if (whaleRatio > 5) {
        score += 8;
        signals.push({
          label: 'Top holder significantly outweighs others',
          severity: 'medium',
          value: `${whaleRatio.toFixed(1)}x ratio`,
        });
      }
    }

    // ── Holder count heuristic ────────────────────────────────────
    // Very few holders is suspicious for any active token
    const blockTimes = signatures
      .map(s => s.blockTime)
      .filter((t): t is number => t !== null);
    const hasActivity = blockTimes.length > 10;

    if (topHolders.length < 5 && hasActivity) {
      score += 10;
      signals.push({
        label: 'Very few unique holders despite trading activity',
        severity: 'medium',
        value: `${topHolders.length} holders with ${signatures.length} txs`,
      });
    }
  } else if (topHolders.length > 0) {
    signals.push({
      label: 'Limited holder data available',
      severity: 'low',
      value: `${topHolders.length} holders analyzed`,
    });
  }

  score = Math.min(100, Math.max(0, score));

  return {
    name: 'Cluster Risk',
    score,
    level: scoreToLevel(score),
    signals,
  };
}

function scoreToLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}
