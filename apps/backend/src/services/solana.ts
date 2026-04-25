import { Connection, clusterApiUrl } from '@solana/web3.js';

let connection: Connection | null = null;

/**
 * Get or create a singleton Solana RPC connection.
 * Uses SOLANA_RPC_URL env var, falls back to mainnet-beta public RPC.
 */
export function getConnection(): Connection {
  if (!connection) {
    const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl('mainnet-beta');
    connection = new Connection(rpcUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 30000,
      disableRetryOnRateLimit: true,
    });
    console.log(`[Solana] Connected to: ${rpcUrl.substring(0, 50)}...`);
  }
  return connection;
}

/**
 * Health check for Solana RPC connection.
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const conn = getConnection();
    const version = await conn.getVersion();
    console.log(`[Solana] RPC version: ${JSON.stringify(version)}`);
    return true;
  } catch (err) {
    console.error('[Solana] Connection health check failed:', err);
    return false;
  }
}
