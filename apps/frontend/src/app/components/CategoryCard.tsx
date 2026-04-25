'use client';

import { useState } from 'react';
import type { CategoryScore } from '@shared/types';
import styles from './CategoryCard.module.css';

interface CategoryCardProps {
  category: CategoryScore;
  icon: string;
}

export default function CategoryCard({ category, icon }: CategoryCardProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className={styles.card} id={`category-${category.name.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className={styles.cardHeader} onClick={() => setExpanded(!expanded)}>
        <div className={styles.cardTitle}>
          <span className={styles.cardIcon}>{icon}</span>
          <span className={styles.cardName}>{category.name}</span>
        </div>
        <div className={styles.cardScore}>
          <div className={styles.scoreBarContainer}>
            <div
              className={`${styles.scoreBarFill} ${styles[category.level]}`}
              style={{ width: `${category.score}%` }}
            />
          </div>
          <span className={`${styles.scoreNumber} ${styles[category.level]}`}>
            {category.score}
          </span>
          <span className={`${styles.expandIcon} ${expanded ? styles.expandIconOpen : ''}`}>
            ▼
          </span>
        </div>
      </div>

      {expanded && category.signals.length > 0 && (
        <div className={styles.signals}>
          {category.signals.map((signal, idx) => (
            <div key={idx} className={styles.signal}>
              <div className={`${styles.signalDot} ${styles[signal.severity]}`} />
              <div className={styles.signalContent}>
                <div className={styles.signalLabel}>
                  {signal.explorerUrl ? (
                    <a
                      href={signal.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.signalLink}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {signal.label}
                      <span className={styles.signalLinkIcon}>↗</span>
                    </a>
                  ) : (
                    signal.label
                  )}
                </div>
                {signal.value && (
                  <div className={styles.signalValue}>{signal.value}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

