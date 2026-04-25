import type { CategoryScore, RiskSignal } from '@shared/types';
import type { SignatureInfo, WalletData } from '../services/dataFetcher';

interface WalletAnalysisInput {
  walletData: WalletData;
  signatures: SignatureInfo[];
}

/**
 * Analyze suspicious wallet behavior patterns.
 * Uses signature-level data + wallet balance for heuristic scoring.
 *
 * Signals checked:
 * - Wallet age < 24 hours (+25)
 * - Near-zero balance with many transactions (+15)
 * - High transaction velocity (+15)
 * - Many failed transactions (+10)
 * - Activity only in short time window (+20)
 * - No token holdings (+10)
 */
export function analyzeWalletBehavior(input: WalletAnalysisInput): CategoryScore {
  const signals: RiskSignal[] = [];
  let score = 0;

  const { walletData, signatures } = input;

  if (signatures.length === 0) {
    return {
      name: 'Suspicious Wallet',
      score: 0,
      level: 'low',
      signals: [
        {
          label: 'No transactions found for this wallet',
          severity: 'low',
          value: '0 txs',
        },
      ],
    };
  }

  // ── Wallet age ────────────────────────────────────────────────
  // Use pre-computed age from route (based on oldest signature) if available
  const blockTimes = signatures
    .map((s) => s.blockTime)
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b);

  const ageHours = walletData.estimatedAgeHours ?? (
    blockTimes.length > 0
      ? (Math.floor(Date.now() / 1000) - blockTimes[0]) / 3600
      : null
  );

  if (ageHours !== null) {
    walletData.estimatedAgeHours = ageHours;

    if (ageHours < 24) {
      score += 25;
      signals.push({
        label: 'Wallet is less than 24 hours old — newly created',
        severity: 'high',
        value: `${ageHours.toFixed(1)} hours`,
      });
    } else if (ageHours < 72) {
      score += 10;
      signals.push({
        label: 'Wallet is less than 3 days old — relatively new',
        severity: 'medium',
        value: `${(ageHours / 24).toFixed(1)} days`,
      });
    } else {
      signals.push({
        label: 'Wallet age',
        severity: 'low',
        value: `${(ageHours / 24).toFixed(0)} days`,
      });
    }
  }

  // ── Near-zero balance with many transactions ──────────────────
  if (walletData.balanceSOL < 0.01 && signatures.length > 10) {
    score += 15;
    signals.push({
      label: 'Wallet has near-zero balance despite many transactions — funds were drained',
      severity: 'high',
      value: `${walletData.balanceSOL.toFixed(4)} SOL remaining, ${signatures.length} txs`,
    });
  } else {
    signals.push({
      label: 'Current balance',
      severity: 'low',
      value: `${walletData.balanceSOL.toFixed(4)} SOL`,
    });
  }

  // ── Transaction velocity ──────────────────────────────────────
  if (blockTimes.length > 1) {
    const totalTimeSpanHours =
      (blockTimes[blockTimes.length - 1] - blockTimes[0]) / 3600;

    if (totalTimeSpanHours > 0) {
      const txPerHour = signatures.length / totalTimeSpanHours;
      if (txPerHour > 50) {
        score += 15;
        signals.push({
          label: 'Extremely high transaction velocity — likely automated',
          severity: 'high',
          value: `${txPerHour.toFixed(0)} txs/hour`,
        });
      } else if (txPerHour > 20) {
        score += 5;
        signals.push({
          label: 'High transaction frequency',
          severity: 'medium',
          value: `${txPerHour.toFixed(0)} txs/hour`,
        });
      }
    }

    // ── Short activity window ─────────────────────────────────────
    if (totalTimeSpanHours < 2 && signatures.length > 15) {
      score += 20;
      signals.push({
        label: 'All activity concentrated in a very short time window',
        severity: 'high',
        value: `${signatures.length} txs in ${(totalTimeSpanHours * 60).toFixed(0)} min`,
      });
    }
  }

  // ── Failed transaction ratio ──────────────────────────────────
  const failedTxs = signatures.filter((s) => s.err).length;
  const failRate = failedTxs / signatures.length;

  if (failedTxs > 3 && failRate > 0.3) {
    score += 10;
    signals.push({
      label: 'High transaction failure rate — possible spam or exploit attempts',
      severity: 'medium',
      value: `${failedTxs}/${signatures.length} failed (${(failRate * 100).toFixed(0)}%)`,
    });
  } else if (failedTxs > 0) {
    signals.push({
      label: 'Transaction success rate',
      severity: 'low',
      value: `${signatures.length - failedTxs}/${signatures.length} successful`,
    });
  }

  // ── No token holdings ─────────────────────────────────────────
  if (walletData.tokenAccounts.length === 0 && signatures.length > 5) {
    score += 10;
    signals.push({
      label: 'No token holdings — wallet may be a temporary pass-through',
      severity: 'medium',
      value: '0 tokens held',
    });
  } else {
    signals.push({
      label: 'Token holdings',
      severity: 'low',
      value: `${walletData.tokenAccounts.length} token(s)`,
    });
  }

  score = Math.min(100, Math.max(0, score));

  return {
    name: 'Suspicious Wallet',
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
