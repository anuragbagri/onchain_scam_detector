'use client';

import type { TokenInfo, WalletInfo } from '@shared/types';
import styles from './MetadataPanel.module.css';

interface MetadataPanelProps {
  tokenInfo?: TokenInfo;
  walletInfo?: WalletInfo;
  mode: 'wallet' | 'token';
}

function formatSupply(supply: number): string {
  if (supply >= 1e12) return `${(supply / 1e12).toFixed(2)}T`;
  if (supply >= 1e9) return `${(supply / 1e9).toFixed(2)}B`;
  if (supply >= 1e6) return `${(supply / 1e6).toFixed(2)}M`;
  if (supply >= 1e3) return `${(supply / 1e3).toFixed(2)}K`;
  return supply.toFixed(2);
}

function formatAge(days: number | null): string {
  if (days === null) return 'Unknown';
  if (days < 1) return `${(days * 24).toFixed(1)} hours`;
  if (days < 30) return `${days.toFixed(1)} days`;
  if (days < 365) return `${(days / 30).toFixed(1)} months`;
  return `${(days / 365).toFixed(1)} years`;
}

export default function MetadataPanel({ tokenInfo, walletInfo, mode }: MetadataPanelProps) {
  if (mode === 'token' && tokenInfo) {
    return (
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelIcon}>🪙</span>
          <span className={styles.panelTitle}>
            {tokenInfo.knownName || 'Token'} Metadata
          </span>
        </div>
        <div className={styles.grid}>
          <div className={styles.item}>
            <span className={styles.itemLabel}>Total Supply</span>
            <span className={styles.itemValue}>{formatSupply(tokenInfo.supply)}</span>
          </div>
          <div className={styles.item}>
            <span className={styles.itemLabel}>Decimals</span>
            <span className={styles.itemValue}>{tokenInfo.decimals}</span>
          </div>
          <div className={styles.item}>
            <span className={styles.itemLabel}>Mint Authority</span>
            <span className={`${styles.itemValue} ${tokenInfo.mintAuthorityRevoked ? styles.safe : styles.danger}`}>
              {tokenInfo.mintAuthorityRevoked ? '🔒 Revoked' : '⚠️ Active'}
            </span>
          </div>
          <div className={styles.item}>
            <span className={styles.itemLabel}>Freeze Authority</span>
            <span className={`${styles.itemValue} ${tokenInfo.freezeAuthorityRevoked ? styles.safe : styles.danger}`}>
              {tokenInfo.freezeAuthorityRevoked ? '🔒 Revoked' : '⚠️ Active'}
            </span>
          </div>
          <div className={styles.item}>
            <span className={styles.itemLabel}>Token Age</span>
            <span className={styles.itemValue}>{formatAge(tokenInfo.estimatedAgeDays)}</span>
          </div>
        </div>
      </div>
    );
  }

  if (walletInfo) {
    return (
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelIcon}>👛</span>
          <span className={styles.panelTitle}>
            {walletInfo.knownName || 'Wallet'} Info
          </span>
        </div>
        <div className={styles.grid}>
          <div className={styles.item}>
            <span className={styles.itemLabel}>Balance</span>
            <span className={styles.itemValue}>{walletInfo.balanceSOL.toFixed(4)} SOL</span>
          </div>
          <div className={styles.item}>
            <span className={styles.itemLabel}>Token Holdings</span>
            <span className={styles.itemValue}>{walletInfo.tokenCount} token(s)</span>
          </div>
          <div className={styles.item}>
            <span className={styles.itemLabel}>Transactions</span>
            <span className={styles.itemValue}>{walletInfo.transactionCount} recent txs</span>
          </div>
          <div className={styles.item}>
            <span className={styles.itemLabel}>Wallet Age</span>
            <span className={styles.itemValue}>{formatAge(walletInfo.estimatedAgeDays)}</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
