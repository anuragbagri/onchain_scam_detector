import type { CategoryScore, RiskSignal } from '@shared/types';
import type { TokenMetadata, SignatureInfo } from '../services/dataFetcher';

interface RugPullInput {
  tokenMetadata: TokenMetadata | null;
  topHolders: { address: string; amount: number }[];
  signatures: SignatureInfo[];
}

/**
 * Analyze rug pull risk for a token.
 *
 * Signals checked:
 * - Mint authority NOT revoked  (+30)
 * - Freeze authority NOT revoked (+20)
 * - Top 10 holders own >50% supply (+25)
 * - Token age < 7 days (+15)
 * - Very low transaction count (+10)
 */
export function analyzeRugPull(input: RugPullInput): CategoryScore {
  const signals: RiskSignal[] = [];
  let score = 0;

  const { tokenMetadata, topHolders, signatures } = input;

  // ── Mint authority ─────────────────────────────────────────
  if (tokenMetadata) {
    if (!tokenMetadata.mintAuthorityRevoked) {
      score += 30;
      signals.push({
        label: 'Mint authority is NOT revoked — creator can mint unlimited tokens',
        severity: 'high',
        value: 'Active',
      });
    } else {
      signals.push({
        label: 'Mint authority is revoked',
        severity: 'low',
        value: 'Revoked ✓',
      });
    }

    // ── Freeze authority ───────────────────────────────────────
    if (!tokenMetadata.freezeAuthorityRevoked) {
      score += 20;
      signals.push({
        label: 'Freeze authority is NOT revoked — creator can freeze token accounts',
        severity: 'high',
        value: 'Active',
      });
    } else {
      signals.push({
        label: 'Freeze authority is revoked',
        severity: 'low',
        value: 'Revoked ✓',
      });
    }

    // ── Token age ──────────────────────────────────────────────
    if (tokenMetadata.estimatedAgeHours !== null) {
      const ageDays = tokenMetadata.estimatedAgeHours / 24;
      if (ageDays < 1) {
        score += 15;
        signals.push({
          label: 'Token is less than 24 hours old — extremely new',
          severity: 'high',
          value: `${tokenMetadata.estimatedAgeHours.toFixed(1)} hours`,
        });
      } else if (ageDays < 7) {
        score += 10;
        signals.push({
          label: 'Token is less than 7 days old — relatively new',
          severity: 'medium',
          value: `${ageDays.toFixed(1)} days`,
        });
      } else {
        signals.push({
          label: 'Token age',
          severity: 'low',
          value: `${ageDays.toFixed(0)} days`,
        });
      }
    }
  } else {
    signals.push({
      label: 'Token metadata unavailable — could not verify mint/freeze authorities',
      severity: 'medium',
    });
  }

  // ── Top holder concentration ─────────────────────────────────
  if (topHolders.length > 0 && tokenMetadata) {
    const totalSupply = tokenMetadata.supply;
    if (totalSupply > 0) {
      const top10Amount = topHolders.slice(0, 10).reduce((sum, h) => sum + h.amount, 0);
      const concentrationPct = (top10Amount / totalSupply) * 100;

      if (concentrationPct > 80) {
        score += 25;
        signals.push({
          label: 'Top 10 holders own >80% of supply — extremely concentrated',
          severity: 'high',
          value: `${concentrationPct.toFixed(1)}%`,
        });
      } else if (concentrationPct > 50) {
        score += 15;
        signals.push({
          label: 'Top 10 holders own >50% of supply — highly concentrated',
          severity: 'medium',
          value: `${concentrationPct.toFixed(1)}%`,
        });
      } else {
        signals.push({
          label: 'Token holder distribution',
          severity: 'low',
          value: `Top 10 hold ${concentrationPct.toFixed(1)}%`,
        });
      }
    }
  }

  // ── Very low transaction count ───────────────────────────────
  if (signatures.length < 10) {
    score += 10;
    signals.push({
      label: 'Very few transactions detected — low activity',
      severity: 'medium',
      value: `${signatures.length} txs`,
    });
  }

  score = Math.min(100, Math.max(0, score));

  return {
    name: 'Rug Pull Risk',
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
