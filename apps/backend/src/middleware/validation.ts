import { Request, Response, NextFunction } from 'express';
import { PublicKey } from '@solana/web3.js';

/**
 * Validate the analyze request body.
 * Expects: { address: string, mode?: 'wallet' | 'token' | 'auto' }
 * If mode is 'auto' or missing, the backend will auto-detect.
 */
export function validateAnalyzeRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { address, mode } = req.body;

  // Check address is present
  if (!address || typeof address !== 'string') {
    res.status(400).json({
      error: 'Missing or invalid "address" field. Must be a Solana address string.',
    });
    return;
  }

  // Validate address format (Base58, valid PublicKey)
  try {
    new PublicKey(address);
  } catch {
    res.status(400).json({
      error: `Invalid Solana address: "${address}". Must be a valid Base58-encoded public key.`,
    });
    return;
  }

  // Validate mode (optional — 'auto' or missing triggers auto-detection)
  if (mode && !['wallet', 'token', 'auto'].includes(mode)) {
    res.status(400).json({
      error: 'Invalid "mode" field. Must be "wallet", "token", or "auto".',
    });
    return;
  }

  next();
}

