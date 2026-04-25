/**
 * Known well-known Solana addresses — used to reduce false positives
 * in scoring when analyzing high-activity protocol addresses.
 */

interface KnownAddress {
  name: string;
  type: 'dex' | 'token' | 'protocol' | 'bridge' | 'infrastructure';
  description: string;
}

const KNOWN_ADDRESSES: Record<string, KnownAddress> = {
  // DEX / AMM
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': {
    name: 'Raydium AMM',
    type: 'dex',
    description: 'Raydium Automated Market Maker program',
  },
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': {
    name: 'Jupiter Aggregator v6',
    type: 'dex',
    description: 'Jupiter DEX aggregator program',
  },
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': {
    name: 'Orca Whirlpools',
    type: 'dex',
    description: 'Orca concentrated liquidity AMM',
  },
  '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin': {
    name: 'Serum DEX v3',
    type: 'dex',
    description: 'Serum decentralized exchange',
  },

  // Major tokens
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': {
    name: 'USDC',
    type: 'token',
    description: 'USD Coin (Circle)',
  },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': {
    name: 'USDT',
    type: 'token',
    description: 'Tether USD',
  },
  'So11111111111111111111111111111111111111112': {
    name: 'Wrapped SOL',
    type: 'token',
    description: 'Wrapped SOL token',
  },
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': {
    name: 'mSOL',
    type: 'token',
    description: 'Marinade staked SOL',
  },
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': {
    name: 'BONK',
    type: 'token',
    description: 'BONK memecoin',
  },

  // Infrastructure / Protocols
  '11111111111111111111111111111111': {
    name: 'System Program',
    type: 'infrastructure',
    description: 'Solana System Program',
  },
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': {
    name: 'Token Program',
    type: 'infrastructure',
    description: 'SPL Token Program',
  },
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL': {
    name: 'Associated Token Program',
    type: 'infrastructure',
    description: 'Associated Token Account Program',
  },

  // Bridge
  'wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb': {
    name: 'Wormhole',
    type: 'bridge',
    description: 'Wormhole cross-chain bridge',
  },
};

/**
 * Check if an address is a well-known program/token.
 */
export function getKnownAddress(address: string): KnownAddress | null {
  return KNOWN_ADDRESSES[address] ?? null;
}

/**
 * Check if the address is a known high-activity address
 * that should have reduced velocity/timing scoring.
 */
export function isKnownHighActivity(address: string): boolean {
  const known = KNOWN_ADDRESSES[address];
  if (!known) return false;
  return ['dex', 'protocol', 'infrastructure', 'bridge'].includes(known.type);
}

/**
 * Generate Solscan URL for an address.
 */
export function solscanAccountUrl(address: string): string {
  return `https://solscan.io/account/${address}`;
}

/**
 * Generate Solscan URL for a transaction.
 */
export function solscanTxUrl(signature: string): string {
  return `https://solscan.io/tx/${signature}`;
}

/**
 * Generate Solscan URL for a token.
 */
export function solscanTokenUrl(mintAddress: string): string {
  return `https://solscan.io/token/${mintAddress}`;
}
