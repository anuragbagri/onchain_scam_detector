'use client';

import type { AnalysisMode } from '@shared/types';
import styles from './HistorySidebar.module.css';

interface HistoryEntry {
  address: string;
  mode: AnalysisMode;
  score: number;
  level: string;
  analyzedAt: string;
}

interface HistorySidebarProps {
  history: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
  onClose: () => void;
  onClear: () => void;
}

function levelColor(level: string) {
  if (level === 'high') return 'var(--color-risk-high)';
  if (level === 'medium') return 'var(--color-risk-medium)';
  return 'var(--color-risk-low)';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function HistorySidebar({
  history,
  onSelect,
  onClose,
  onClear,
}: HistorySidebarProps) {
  return (
    <>
      {/* Backdrop */}
      <div className={styles.backdrop} onClick={onClose} />

      {/* Panel */}
      <aside className={styles.sidebar} id="history-sidebar">
        <div className={styles.sidebarHeader}>
          <h3 className={styles.sidebarTitle}>🕒 History</h3>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {history.length === 0 ? (
          <p className={styles.empty}>No analyses yet</p>
        ) : (
          <div className={styles.list}>
            {history.map((entry, idx) => (
              <button
                key={`${entry.address}-${idx}`}
                className={styles.historyItem}
                onClick={() => onSelect(entry)}
              >
                <div className={styles.itemTop}>
                  <span className={styles.modeIcon}>
                    {entry.mode === 'token' ? '🪙' : '👛'}
                  </span>
                  <code className={styles.itemAddress}>
                    {entry.address.slice(0, 6)}...{entry.address.slice(-4)}
                  </code>
                  <span
                    className={styles.itemScore}
                    style={{ color: levelColor(entry.level) }}
                  >
                    {entry.score}
                  </span>
                </div>
                <div className={styles.itemBottom}>
                  <span
                    className={styles.riskBadge}
                    style={{
                      color: levelColor(entry.level),
                      borderColor: levelColor(entry.level),
                    }}
                  >
                    {entry.level.toUpperCase()}
                  </span>
                  <span className={styles.itemTime}>
                    {timeAgo(entry.analyzedAt)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {history.length > 0 && (
          <button className={styles.clearBtn} onClick={onClear}>
            Clear All History
          </button>
        )}
      </aside>
    </>
  );
}
