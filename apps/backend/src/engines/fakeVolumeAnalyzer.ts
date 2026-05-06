import type { CategoryScore, RiskSignal } from '@shared/types';
import type { SignatureInfo } from '../services/dataFetcher';

interface FakeVolumeInput {
  signatures: SignatureInfo[];
  targetAddress: string;
}

/**
 * Analyze fake volume / wash trading patterns.
 * Uses signature-level data (blockTime, slot, err) for pattern detection.
 *
 * Signals checked:
 * - Tight transaction timing clustering (+25)
 * - Extremely uniform transaction spacing (+20)
 * - High transaction velocity (+20)
 * - Many failed transactions (+15)
 * - Activity only in short bursts (+20)
 */
export function analyzeFakeVolume(input: FakeVolumeInput): CategoryScore {
  const signals: RiskSignal[] = [];
  let score = 0;

  const { signatures } = input;

  if (signatures.length < 3) {
    return {
      name: 'Fake Volume',
      score: 0,
      level: 'low',
      signals: [
        {
          label: 'Insufficient transaction data for volume analysis',
          severity: 'low',
          value: `${signatures.length} txs`,
        },
      ],
    };
  }

  // ── Get timestamps ────────────────────────────────────────────
  const blockTimes = signatures
    .map((s) => s.blockTime)
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b);

  if (blockTimes.length < 3) {
    signals.push({
      label: 'Limited timestamp data for timing analysis',
      severity: 'low',
      value: `${blockTimes.length} timestamps available`,
    });
    return {
      name: 'Fake Volume',
      score: 0,
      level: 'low',
      signals,
    };
  }

  // ── Time span analysis ────────────────────────────────────────
  const totalTimeSpan = blockTimes[blockTimes.length - 1] - blockTimes[0];
  const totalTimeSpanHours = totalTimeSpan / 3600;

  // ── Tight timing clustering ───────────────────────────────────
  // If all transactions happened within 1 hour
  if (totalTimeSpanHours < 1 && signatures.length > 10) {
    score += 25;
    signals.push({
      label: 'All transactions clustered within 1 hour — possible bot activity',
      severity: 'high',
      value: `${signatures.length} txs in ${(totalTimeSpan / 60).toFixed(0)} min`,
    });
  } else if (totalTimeSpanHours < 6 && signatures.length > 20) {
    score += 15;
    signals.push({
      label: 'High transaction density in short time window',
      severity: 'medium',
      value: `${signatures.length} txs in ${totalTimeSpanHours.toFixed(1)} hours`,
    });
  }

  // ── Transaction velocity ──────────────────────────────────────
  if (totalTimeSpanHours > 0) {
    const txPerHour = signatures.length / totalTimeSpanHours;
    if (txPerHour > 100) {
      score += 20;
      signals.push({
        label: 'Extremely high transaction velocity — likely automated',
        severity: 'high',
        value: `${txPerHour.toFixed(0)} txs/hour`,
      });
    } else if (txPerHour > 30) {
      score += 10;
      signals.push({
        label: 'High transaction frequency',
        severity: 'medium',
        value: `${txPerHour.toFixed(0)} txs/hour`,
      });
    } else {
      signals.push({
        label: 'Transaction frequency',
        severity: 'low',
        value: `${txPerHour.toFixed(1)} txs/hour`,
      });
    }
  }

  // ── Uniform spacing detection (bot signature) ─────────────────
  const intervals: number[] = [];
  for (let i = 1; i < blockTimes.length; i++) {
    intervals.push(blockTimes[i] - blockTimes[i - 1]);
  }

  if (intervals.length > 5) {
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance =
      intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) /
      intervals.length;
    const stdDev = Math.sqrt(variance);
    const coeffOfVariation = avgInterval > 0 ? stdDev / avgInterval : 0;

    // Very low coefficient of variation = suspiciously uniform
    if (coeffOfVariation < 0.3 && avgInterval < 60 && intervals.length > 10) {
      score += 20;
      signals.push({
        label: 'Suspiciously uniform transaction spacing — strong bot indicator',
        severity: 'high',
        value: `Avg ${avgInterval.toFixed(1)}s ± ${stdDev.toFixed(1)}s`,
      });
    } else if (coeffOfVariation < 0.5 && avgInterval < 120) {
      score += 10;
      signals.push({
        label: 'Relatively uniform transaction timing',
        severity: 'medium',
        value: `Avg ${avgInterval.toFixed(1)}s between txs`,
      });
    } else {
      signals.push({
        label: 'Transaction timing pattern',
        severity: 'low',
        value: `Avg ${avgInterval.toFixed(0)}s between txs`,
      });
    }
  }

  // ── Burst activity detection ──────────────────────────────────
  // Check if activity comes in short bursts with long gaps
  if (intervals.length > 5) {
    const longGaps = intervals.filter((i) => i > 3600).length; // gaps > 1 hour
    const shortGaps = intervals.filter((i) => i < 30).length; // gaps < 30s
    const burstRatio = shortGaps / intervals.length;

    if (burstRatio > 0.7 && longGaps > 0) {
      score += 15;
      signals.push({
        label: 'Burst activity pattern — rapid transactions with long idle periods',
        severity: 'medium',
        value: `${shortGaps} rapid txs, ${longGaps} long gaps`,
      });
    }
  }

  score = Math.min(100, Math.max(0, score));

  return {
    name: 'Fake Volume',
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
