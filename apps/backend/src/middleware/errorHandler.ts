import { Request, Response, NextFunction } from 'express';

/**
 * Global error handling middleware.
 * Catches errors from async route handlers and returns user-friendly messages.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Error]', err.message, err.stack);

  // Solana RPC errors
  if (err.message.includes('429') || err.message.includes('Too Many Requests')) {
    res.status(429).json({
      error: 'Rate limited by Solana RPC. Please try again in a few seconds.',
      code: 'RPC_RATE_LIMIT',
    });
    return;
  }

  if (err.message.includes('failed to get') || err.message.includes('FetchError')) {
    res.status(502).json({
      error: 'Failed to fetch data from Solana network. The RPC might be temporarily unavailable.',
      code: 'RPC_UNAVAILABLE',
    });
    return;
  }

  if (err.message.includes('timeout') || err.message.includes('ETIMEDOUT')) {
    res.status(504).json({
      error: 'Request timed out while fetching blockchain data. Please try again.',
      code: 'RPC_TIMEOUT',
    });
    return;
  }

  // Default server error
  res.status(500).json({
    error: 'Internal server error. Please try again later.',
    code: 'INTERNAL_ERROR',
  });
}
