'use client';

import { useState } from 'react';
import type { AnalysisMode } from '@shared/types';
import styles from './SearchInput.module.css';

type InputMode = AnalysisMode | 'auto';

interface SearchInputProps {
  onAnalyze: (address: string, mode: InputMode) => void;
  isLoading: boolean;
}

export default function SearchInput({ onAnalyze, isLoading }: SearchInputProps) {
  const [address, setAddress] = useState('');
  const [mode, setMode] = useState<InputMode>('auto');

  const handleSubmit = () => {
    const trimmed = address.trim();
    if (!trimmed) return;
    onAnalyze(trimmed, mode);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setAddress(text.trim());
    } catch {
      // Clipboard access denied — ignore
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSubmit();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.modeToggle}>
        <button
          className={`${styles.modeBtn} ${mode === 'auto' ? styles.modeBtnActive : ''}`}
          onClick={() => setMode('auto')}
          id="mode-auto"
          title="Auto-detect address type"
        >
          ✨ Auto
        </button>
        <button
          className={`${styles.modeBtn} ${mode === 'wallet' ? styles.modeBtnActive : ''}`}
          onClick={() => setMode('wallet')}
          id="mode-wallet"
        >
          👛 Wallet
        </button>
        <button
          className={`${styles.modeBtn} ${mode === 'token' ? styles.modeBtnActive : ''}`}
          onClick={() => setMode('token')}
          id="mode-token"
        >
          🪙 Token
        </button>
      </div>

      <div className={styles.inputRow}>
        <input
          id="address-input"
          className={styles.input}
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter any Solana address..."
          disabled={isLoading}
          spellCheck={false}
          autoComplete="off"
        />
        <button
          className={styles.pasteBtn}
          onClick={handlePaste}
          disabled={isLoading}
          title="Paste from clipboard"
        >
          📋 Paste
        </button>
        <button
          id="analyze-btn"
          className={`${styles.analyzeBtn} ${isLoading ? styles.analyzeBtnLoading : ''}`}
          onClick={handleSubmit}
          disabled={isLoading || !address.trim()}
        >
          {isLoading ? 'Analyzing...' : 'Analyze Risk'}
        </button>
      </div>
    </div>
  );
}

