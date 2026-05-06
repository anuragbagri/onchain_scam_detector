/**
 * LP Health Analyzer — checks liquidity pool status for tokens.
 *
 * This is the #1 rug pull indicator in the industry.
 * Uses Raydium V3 API (free, no RPC cost) to check pool status.
 *
 * Signals:
 * - No LP pool found (+30)
 * - LP not locked/burned (+35)
 * - LP burned (−15, reduces risk)
 * - Very low liquidity (+20)
 */

import type { CategoryScore, RiskSignal } from '@shared/types';

export interface LPPoolInfo {
  hasPool: boolean;
  poolAddress?: string;
  lpMint?: string;
  liquidity?: number;        // USD value
  isLocked: boolean;
  isBurned: boolean;
  lpLockerName?: string;     // e.g. "Raydium Burn & Earn"
}

/**
 * Fetch LP pool info from Raydium V3 API.
 * Falls back gracefully if the API is unavailable.
 */
export async function fetchLPPoolInfo(mintAddress: string): Promise<LPPoolInfo> {
  try {
    const url = `https://api-v3.raydium.io/pools/info/mint?mint1=${mintAddress}&poolType=all&poolSortField=default&sortType=desc&pageSize=1&page=1`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`[LP] Raydium API returned ${response.status}`);
      return { hasPool: false, isLocked: false, isBurned: false };
    }

    const json = await response.json() as any;
    const pools = json?.data?.data;

    if (!pools || pools.length === 0) {
      return { hasPool: false, isLocked: false, isBurned: false };
    }

    const pool = pools[0];
    const liquidity = pool.tvl || pool.liquidity || 0;

    // Check LP burn status from pool data
    const isBurned = pool.burnPercent > 50 || pool.lpBurned === true;
    const isLocked = isBurned || pool.lpLocked === true;

    return {
      hasPool: true,
      poolAddress: pool.id || pool.poolId,
      lpMint: pool.lpMint?.address,
      liquidity,
      isLocked,
      isBurned,
      lpLockerName: isBurned ? 'Burned' : (pool.lpLocked ? 'Locked' : undefined),
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.log('[LP] Raydium API timeout — skipping LP analysis');
    } else {
      console.log(`[LP] Raydium API error: ${err.message}`);
    }
    return { hasPool: false, isLocked: false, isBurned: false };
  }
}

/**
 * Analyze LP health and produce risk signals.
 */
export function analyzeLPHealth(lpInfo: LPPoolInfo, isTokenMode: boolean): CategoryScore {
  const signals: RiskSignal[] = [];
  let score = 0;

  if (!isTokenMode) {
    // LP analysis is not applicable for wallets
    return {
      name: 'LP Health',
      score: 0,
      level: 'low',
      signals: [{ label: 'LP analysis not applicable for wallet addresses', severity: 'low' }],
    };
  }

  if (!lpInfo.hasPool) {
    score += 30;
    signals.push({
      label: 'No liquidity pool found — token may not be tradeable',
      severity: 'high',
      value: 'No pool detected',
    });
  } else {
    // Pool exists
    signals.push({
      label: 'Liquidity pool found',
      severity: 'low',
      value: lpInfo.poolAddress ? `Pool: ${lpInfo.poolAddress.slice(0, 8)}...` : 'Active',
    });

    // Check LP lock status
    if (lpInfo.isBurned) {
      score -= 15;
      signals.push({
        label: 'LP tokens burned — liquidity is permanently locked ✓',
        severity: 'low',
        value: 'Burned',
      });
    } else if (lpInfo.isLocked) {
      score -= 10;
      signals.push({
        label: 'LP tokens locked in contract',
        severity: 'low',
        value: lpInfo.lpLockerName || 'Locked',
      });
    } else {
      score += 35;
      signals.push({
        label: 'LP tokens NOT locked or burned — developer can withdraw liquidity at any time',
        severity: 'high',
        value: 'Unlocked ⚠️',
      });
    }

    // Liquidity amount check
    if (lpInfo.liquidity !== undefined) {
      if (lpInfo.liquidity < 1000) {
        score += 20;
        signals.push({
          label: 'Very low liquidity — high price manipulation risk',
          severity: 'high',
          value: `$${lpInfo.liquidity.toFixed(0)} TVL`,
        });
      } else if (lpInfo.liquidity < 10000) {
        score += 10;
        signals.push({
          label: 'Low liquidity pool',
          severity: 'medium',
          value: `$${(lpInfo.liquidity / 1000).toFixed(1)}K TVL`,
        });
      } else {
        signals.push({
          label: 'Liquidity level',
          severity: 'low',
          value: `$${(lpInfo.liquidity / 1000).toFixed(1)}K TVL`,
        });
      }
    }
  }

  score = Math.min(100, Math.max(0, score));

  return {
    name: 'LP Health',
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
