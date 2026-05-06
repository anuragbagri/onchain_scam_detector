'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AnalysisResult, AnalysisMode } from '@shared/types';
import { analyzeAddress } from './lib/api';
import SearchInput from './components/SearchInput';
import RiskGauge from './components/RiskGauge';
import CategoryCard from './components/CategoryCard';
import AnalysisProgress from './components/AnalysisProgress';
import HistorySidebar from './components/HistorySidebar';
import MetadataPanel from './components/MetadataPanel';
import ShareReport from './components/ShareReport';
import MLInsightCard from './components/MLInsightCard';
import styles from './page.module.css';

// Example addresses for quick demo
const EXAMPLES = [
  {
    label: 'Raydium AMM',
    address: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
    mode: 'auto' as const,
  },
  {
    label: 'USDC Token',
    address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    mode: 'auto' as const,
  },
  {
    label: 'Jupiter',
    address: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
    mode: 'auto' as const,
  },
];

type AppState = 'idle' | 'loading' | 'result' | 'error';

interface HistoryEntry {
  address: string;
  mode: AnalysisMode;
  score: number;
  level: string;
  analyzedAt: string;
}

function getSolscanUrl(address: string, mode: AnalysisMode): string {
  if (mode === 'token') return `https://solscan.io/token/${address}`;
  return `https://solscan.io/account/${address}`;
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function HomePage() {
  const [state, setState] = useState<AppState>('idle');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string>('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('scam_detector_history');
      if (saved) setHistory(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  }, []);

  // Save history to localStorage
  const saveToHistory = useCallback(
    (data: AnalysisResult) => {
      const entry: HistoryEntry = {
        address: data.address,
        mode: data.mode,
        score: data.overallScore,
        level: data.overallLevel,
        analyzedAt: data.analyzedAt,
      };

      setHistory((prev) => {
        const filtered = prev.filter((h) => h.address !== entry.address);
        const updated = [entry, ...filtered].slice(0, 20); // Keep last 20
        try {
          localStorage.setItem('scam_detector_history', JSON.stringify(updated));
        } catch {
          /* ignore */
        }
        return updated;
      });
    },
    []
  );

  const handleAnalyze = async (address: string, mode: AnalysisMode | 'auto') => {
    setState('loading');
    setError('');
    setResult(null);
    setCopied(false);

    try {
      const data = await analyzeAddress(address, mode);
      setResult(data);
      setState('result');
      saveToHistory(data);
    } catch (err: any) {
      setError(err.message || 'Analysis failed. Please try again.');
      setState('error');
    }
  };

  const handleHistoryClick = (entry: HistoryEntry) => {
    setHistoryOpen(false);
    handleAnalyze(entry.address, entry.mode);
  };

  const handleClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem('scam_detector_history');
    } catch {
      /* ignore */
    }
  };

  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={styles.page}>
      {/* History toggle */}
      {history.length > 0 && (
        <button
          className={styles.historyToggle}
          onClick={() => setHistoryOpen(!historyOpen)}
          title="Analysis History"
          id="history-toggle"
        >
          🕒 <span className={styles.historyBadge}>{history.length}</span>
        </button>
      )}

      {/* History sidebar */}
      {historyOpen && (
        <HistorySidebar
          history={history}
          onSelect={handleHistoryClick}
          onClose={() => setHistoryOpen(false)}
          onClear={handleClearHistory}
        />
      )}

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logoRow}>
          <span className={styles.shield}>🛡️</span>
          <h1 className={styles.title}>Solana Scam Detector</h1>
        </div>
        <p className={styles.subtitle}>
          Analyze any Solana wallet or token for rug pull risk, fake volume, and suspicious behavior.
          Powered by real on-chain data.
        </p>
      </header>

      {/* Main content */}
      <main className={styles.main}>
        {/* Search */}
        <SearchInput onAnalyze={handleAnalyze} isLoading={state === 'loading'} />

        {/* Loading state */}
        {state === 'loading' && <AnalysisProgress />}

        {/* Error state */}
        {state === 'error' && (
          <div className={styles.errorState}>
            <div className={styles.errorIcon}>⚠️</div>
            <p className={styles.errorMessage}>{error}</p>
            <button
              className={styles.retryBtn}
              onClick={() => setState('idle')}
            >
              Try Again
            </button>
          </div>
        )}

        {/* Results */}
        {state === 'result' && result && (
          <div className={styles.resultsSection}>
            {/* Address bar with Solscan link + copy */}
            <div className={styles.addressBar}>
              <span className={styles.addressLabel}>
                {result.mode === 'token' ? '🪙' : '👛'}{' '}
                {result.mode === 'token' ? 'Token' : 'Wallet'}:
              </span>
              <code className={styles.addressText}>
                {truncateAddress(result.address)}
              </code>
              <button
                className={styles.copyBtn}
                onClick={() => handleCopyAddress(result.address)}
                title="Copy full address"
              >
                {copied ? '✅ Copied!' : '📋 Copy'}
              </button>
              <a
                href={getSolscanUrl(result.address, result.mode)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.explorerLink}
                title="View on Solscan"
              >
                View on Solscan ↗
              </a>
            </div>

            {/* Summary banner */}
            <div className={`${styles.summaryBanner} ${styles[result.overallLevel]}`}>
              {result.summary}
            </div>

            {/* Token/Wallet Metadata */}
            <MetadataPanel
              tokenInfo={result.tokenInfo}
              walletInfo={result.walletInfo}
              mode={result.mode}
            />

            <div className={styles.scoreAndCategories}>
              {/* Risk Gauge */}
              <RiskGauge score={result.overallScore} level={result.overallLevel} />

              {/* Category Cards */}
              <div className={styles.categoriesColumn}>
                <CategoryCard category={result.categories.rugPull} icon="💣" />
                <CategoryCard category={result.categories.fakeVolume} icon="📊" />
                <CategoryCard category={result.categories.suspiciousWallet} icon="👤" />
                <CategoryCard category={result.categories.lpHealth} icon="🔗" />
                <CategoryCard category={result.categories.clusterRisk} icon="🕸️" />
              </div>
            </div>

            {/* ML Insight */}
            <MLInsightCard mlInsight={result.mlInsight} />

            {/* Confidence indicator */}
            {result.confidence !== undefined && (
              <div className={styles.confidenceRow}>
                <span className={styles.confidenceLabel}>Data Quality:</span>
                <div className={styles.confidenceBar}>
                  <div
                    className={styles.confidenceFill}
                    style={{ width: `${Math.round(result.confidence * 100)}%` }}
                  />
                </div>
                <span className={styles.confidenceValue}>
                  {Math.round(result.confidence * 100)}%
                </span>
              </div>
            )}

            {/* Analyzed timestamp */}
            <div className={styles.metaRow}>
              <span>Analyzed: {new Date(result.analyzedAt).toLocaleString()}</span>
              <button
                className={styles.newAnalysisBtn}
                onClick={() => setState('idle')}
              >
                New Analysis
              </button>
            </div>

            {/* Share/Export */}
            <ShareReport result={result} />

            <p className={styles.disclaimer}>
              ⚠️ This is a heuristic-based analysis tool. Not financial advice.
              Always do your own research before making investment decisions.
            </p>
          </div>
        )}

        {/* Empty/Idle state */}
        {state === 'idle' && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🔎</div>
            <h2 className={styles.emptyTitle}>Enter an address to start</h2>
            <p className={styles.emptySubtitle}>
              Paste a Solana wallet or token mint address above to analyze its on-chain risk profile.
              Auto-detect mode will figure out the address type for you.
            </p>

            {/* Example addresses */}
            <div className={styles.examplesSection}>
              <div className={styles.examplesLabel}>Try these examples</div>
              <div className={styles.exampleButtons}>
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.address}
                    className={styles.exampleBtn}
                    onClick={() => handleAnalyze(ex.address, ex.mode)}
                  >
                    <span className={styles.exampleBtnLabel}>{ex.label}</span>
                    {ex.address.slice(0, 8)}...{ex.address.slice(-4)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <span className={styles.footerBrand}>🛡️ Solana Scam Detector</span>
          <span className={styles.footerDivider}>·</span>
          <span>On-chain risk analysis powered by Solana RPC</span>
          <span className={styles.footerDivider}>·</span>
          <a
            href="https://solscan.io"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.footerLink}
          >
            Solscan
          </a>
        </div>
      </footer>
    </div>
  );
}

