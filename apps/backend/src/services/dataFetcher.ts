import {
  PublicKey,
  ConfirmedSignatureInfo,
  ParsedAccountData,
} from '@solana/web3.js';
import { getConnection } from './solana';

// ── Exported interfaces ──────────────────────────────────────────────

/**
 * Lightweight transaction info derived from signatures endpoint.
 * We avoid getParsedTransaction entirely because the public RPC
 * rate-limits it aggressively (~1 req/10s).
 */
export interface SignatureInfo {
  signature: string;
  slot: number;
  blockTime: number | null;
  err: boolean;
  memo: string | null;
}

export interface TokenMetadata {
  mintAddress: string;
  supply: number;
  decimals: number;
  mintAuthorityRevoked: boolean;
  freezeAuthorityRevoked: boolean;
  estimatedAgeHours: number | null;
}

export interface WalletData {
  address: string;
  balanceLamports: number;
  balanceSOL: number;
  tokenAccounts: { mint: string; amount: number }[];
  estimatedAgeHours: number | null;
}

// ── Helpers ──────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isRateLimit =
        err.message?.includes('429') ||
        err.message?.includes('Too many requests') ||
        err.message?.includes('Too Many Requests');

      if (isRateLimit && attempt < retries) {
        const delay = Math.pow(2, attempt) * 1500 + Math.random() * 500;
        console.log(`[RPC] Rate limited, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${retries})`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}

// ── Data fetching functions ──────────────────────────────────────────

/**
 * Fetch recent transaction signatures for an address.
 * This is a lightweight call that returns blockTime, slot, err, and memo
 * without needing the expensive getParsedTransaction.
 */
export async function fetchSignatures(
  address: string,
  limit: number = 50
): Promise<SignatureInfo[]> {
  const conn = getConnection();
  const pubkey = new PublicKey(address);

  const sigs = await withRetry(() =>
    conn.getSignaturesForAddress(pubkey, { limit })
  );

  return sigs.map((s) => ({
    signature: s.signature,
    slot: s.slot,
    blockTime: s.blockTime ?? null,
    err: s.err !== null,
    memo: s.memo,
  }));
}

/**
 * Estimate wallet age by binary-searching for the oldest signature.
 * Uses the 'before' cursor to page through history efficiently.
 */
export async function estimateWalletAge(
  address: string,
  recentSignatures: SignatureInfo[]
): Promise<number | null> {
  const conn = getConnection();
  const pubkey = new PublicKey(address);

  try {
    // Start from the oldest signature we already have and keep paging back
    let oldestSig = recentSignatures.length > 0
      ? recentSignatures[recentSignatures.length - 1].signature
      : undefined;
    let oldestBlockTime: number | null = recentSignatures.length > 0
      ? recentSignatures[recentSignatures.length - 1].blockTime
      : null;

    // Page back up to 3 times (each fetches 1000) to find the true oldest
    for (let i = 0; i < 3; i++) {
      await sleep(300);
      const older = await withRetry(() =>
        conn.getSignaturesForAddress(pubkey, {
          limit: 1000,
          before: oldestSig,
        })
      );

      if (older.length === 0) break; // Reached the beginning

      oldestSig = older[older.length - 1].signature;
      oldestBlockTime = older[older.length - 1].blockTime ?? oldestBlockTime;

      if (older.length < 1000) break; // No more pages
    }

    if (oldestBlockTime) {
      const nowSec = Math.floor(Date.now() / 1000);
      return (nowSec - oldestBlockTime) / 3600;
    }
  } catch {
    // Age estimation is optional — don't fail the whole analysis
  }

  return null;
}

/**
 * Fetch token mint metadata (supply, authorities, etc.)
 * Uses getParsedAccountInfo which is lighter than getParsedTransaction.
 */
export async function fetchTokenMetadata(
  mintAddress: string
): Promise<TokenMetadata | null> {
  const conn = getConnection();
  try {
    const pubkey = new PublicKey(mintAddress);
    const accountInfo = await withRetry(() => conn.getParsedAccountInfo(pubkey));

    if (!accountInfo.value) return null;

    const data = accountInfo.value.data;
    if (!('parsed' in data)) return null;

    const parsed = (data as ParsedAccountData).parsed;
    if (parsed.type !== 'mint') return null;

    const info = parsed.info;
    const supply = parseFloat(info.supply) / Math.pow(10, info.decimals);

    // Estimate age from slot
    await sleep(300);
    const currentSlot = await withRetry(() => conn.getSlot());
    const slotDiff = currentSlot - accountInfo.context.slot;
    // Solana produces ~2.5 slots/sec → ~400ms per slot
    const estimatedAgeHours = (slotDiff * 0.4) / 3600;

    return {
      mintAddress,
      supply,
      decimals: info.decimals,
      mintAuthorityRevoked: info.mintAuthority === null,
      freezeAuthorityRevoked: info.freezeAuthority === null,
      estimatedAgeHours: estimatedAgeHours > 0 ? estimatedAgeHours : null,
    };
  } catch (err) {
    console.error(`[DataFetcher] Failed to fetch token metadata for ${mintAddress}:`, err);
    return null;
  }
}

/**
 * Fetch wallet balance and token accounts.
 */
export async function fetchWalletData(address: string): Promise<WalletData> {
  const conn = getConnection();
  const pubkey = new PublicKey(address);

  const balance = await withRetry(() => conn.getBalance(pubkey));
  await sleep(500);

  let tokenAccounts;
  try {
    tokenAccounts = await withRetry(() =>
      conn.getParsedTokenAccountsByOwner(pubkey, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      })
    );
  } catch {
    tokenAccounts = { value: [] };
  }

  const tokens = tokenAccounts.value.map((ta) => {
    const info = ta.account.data.parsed.info;
    return {
      mint: info.mint as string,
      amount: parseFloat(info.tokenAmount.uiAmountString || '0'),
    };
  });

  // Estimate wallet age from the signatures we already fetched
  // (caller provides this — we just set a default)
  return {
    address,
    balanceLamports: balance,
    balanceSOL: balance / 1e9,
    tokenAccounts: tokens,
    estimatedAgeHours: null, // Will be set from signatures data
  };
}

/**
 * Fetch top token holders for a mint address.
 */
export async function fetchTopHolders(
  mintAddress: string,
  limit: number = 20
): Promise<{ address: string; amount: number }[]> {
  const conn = getConnection();
  try {
    const pubkey = new PublicKey(mintAddress);
    const largestAccounts = await withRetry(() =>
      conn.getTokenLargestAccounts(pubkey)
    );

    return largestAccounts.value.slice(0, limit).map((account) => ({
      address: account.address.toBase58(),
      amount: parseFloat(account.uiAmountString || '0'),
    }));
  } catch (err) {
    console.error(`[DataFetcher] Failed to fetch top holders for ${mintAddress}:`, err);
    return [];
  }
}

/**
 * Auto-detect whether an address is a token mint or a regular wallet.
 * Uses getParsedAccountInfo to check the account type.
 */
export async function detectAddressType(
  address: string
): Promise<'token' | 'wallet'> {
  const conn = getConnection();
  try {
    const pubkey = new PublicKey(address);
    const accountInfo = await withRetry(() => conn.getParsedAccountInfo(pubkey));

    if (!accountInfo.value) return 'wallet';

    const data = accountInfo.value.data;
    if ('parsed' in data) {
      const parsed = (data as ParsedAccountData).parsed;
      if (parsed.type === 'mint') return 'token';
    }

    return 'wallet';
  } catch {
    return 'wallet'; // Default to wallet on error
  }
}
