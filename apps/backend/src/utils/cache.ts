import type { AnalysisResult } from '@shared/types';

interface CacheEntry {
  result: AnalysisResult;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get a cached analysis result.
 */
export function getCached(address: string): AnalysisResult | null {
  const entry = cache.get(address.toLowerCase());
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    cache.delete(address.toLowerCase());
    return null;
  }

  return entry.result;
}

/**
 * Store an analysis result in cache.
 */
export function setCache(address: string, result: AnalysisResult, ttlMs?: number): void {
  cache.set(address.toLowerCase(), {
    result,
    expiresAt: Date.now() + (ttlMs || DEFAULT_TTL_MS),
  });
}

/**
 * Clear all cached entries.
 */
export function clearCache(): void {
  cache.clear();
}
