import { Router, Request, Response, NextFunction } from 'express';
import type { AnalysisMode } from '@shared/types';
import { validateAnalyzeRequest } from '../middleware/validation';
import {
  fetchSignatures,
  fetchTokenMetadata,
  fetchWalletData,
  fetchTopHolders,
  estimateWalletAge,
  detectAddressType,
} from '../services/dataFetcher';
import { computeRiskScore } from '../engines/riskScorer';
import { getCached, setCache } from '../utils/cache';
import {
  getKnownAddress,
  isKnownHighActivity,
  solscanAccountUrl,
  solscanTokenUrl,
} from '../utils/knownAddresses';

const router = Router();

/**
 * POST /api/analyze
 * Body: { address: string, mode?: 'wallet' | 'token' | 'auto' }
 * Returns: AnalysisResult
 */
router.post(
  '/analyze',
  validateAnalyzeRequest,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { address } = req.body as { address: string; mode?: string };
      let mode: AnalysisMode = req.body.mode as AnalysisMode;

      // Check cache first
      const cached = getCached(address);
      if (cached) {
        console.log(`[Analyze] Cache hit for ${address}`);
        res.json(cached);
        return;
      }

      console.log(`[Analyze] Starting analysis for ${address} (requested mode: ${mode || 'auto'})`);
      const startTime = Date.now();

      // Auto-detect address type if mode is 'auto' or not specified
      if (!mode || mode === ('auto' as any)) {
        console.log(`[Analyze] Auto-detecting address type...`);
        mode = await detectAddressType(address);
        console.log(`[Analyze] Detected as: ${mode}`);
      }

      // Check if this is a known address
      const knownAddr = getKnownAddress(address);
      const isHighActivity = isKnownHighActivity(address);
      if (knownAddr) {
        console.log(`[Analyze] Known address: ${knownAddr.name} (${knownAddr.type})`);
      }

      // 1. Fetch signatures (lightweight — gives blockTime, slot, err)
      console.log(`[Analyze] Fetching signatures...`);
      const signatures = await fetchSignatures(address, 50);
      console.log(`[Analyze] Found ${signatures.length} signatures`);

      // 2. Fetch token metadata (if token mode)
      let tokenMetadata = null;
      let topHolders: { address: string; amount: number }[] = [];

      if (mode === 'token') {
        console.log(`[Analyze] Fetching token metadata...`);
        tokenMetadata = await fetchTokenMetadata(address);
        console.log(`[Analyze] Fetching top holders...`);
        topHolders = await fetchTopHolders(address);
      }

      // 3. Fetch wallet data (balance + token accounts)
      console.log(`[Analyze] Fetching wallet data...`);
      const walletData = await fetchWalletData(address);

      // 4. Estimate wallet age (pages back through history)
      console.log(`[Analyze] Estimating wallet age...`);
      walletData.estimatedAgeHours = await estimateWalletAge(address, signatures);

      // 5. Compute risk score
      console.log(`[Analyze] Computing risk score...`);
      const result = computeRiskScore({
        address,
        mode,
        signatures,
        tokenMetadata,
        topHolders,
        walletData,
        knownAddress: knownAddr,
        isKnownHighActivity: isHighActivity,
      });

      // Add explorer URL to the result metadata
      const explorerBaseUrl = mode === 'token'
        ? solscanTokenUrl(address)
        : solscanAccountUrl(address);

      // Inject explorer URLs into signals that reference specific transactions
      for (const catKey of Object.keys(result.categories) as Array<keyof typeof result.categories>) {
        for (const signal of result.categories[catKey].signals) {
          if (!signal.explorerUrl) {
            // Default: link to the account/token page on Solscan
            signal.explorerUrl = explorerBaseUrl;
          }
        }
      }

      // Cache the result
      setCache(address, result);

      const elapsed = Date.now() - startTime;
      console.log(
        `[Analyze] Complete in ${elapsed}ms — Score: ${result.overallScore}/100 (${result.overallLevel})`
      );

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;

