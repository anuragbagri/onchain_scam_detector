'use client';

import type { MLInsight } from '@shared/types';
import styles from './MLInsightCard.module.css';

interface MLInsightCardProps {
  mlInsight: MLInsight;
}

const FEATURE_LABELS: Record<string, string> = {
  mintAuthorityActive: 'Mint Authority',
  freezeAuthorityActive: 'Freeze Authority',
  tokenAgeNorm: 'Token Age',
  supplyConcentrationTop10: 'Holder Concentration',
  supplyConcentrationTop1: 'Top Holder Share',
  txCount: 'Transaction Count',
  txFailureRate: 'Failure Rate',
  txVelocity: 'TX Velocity',
  timeSpanNorm: 'Time Span',
  timingUniformity: 'Timing Uniformity',
  burstRatio: 'Burst Activity',
  balanceSOLNorm: 'SOL Balance',
  balanceDrainRatio: 'Balance Drain',
  tokenHoldingsCount: 'Token Holdings',
  walletAgeNorm: 'Wallet Age',
  hasLPPool: 'LP Pool Exists',
  lpLocked: 'LP Locked',
  isKnownAddress: 'Known Address',
};

export default function MLInsightCard({ mlInsight }: MLInsightCardProps) {
  if (!mlInsight.modelAvailable) {
    return (
      <div className={styles.card}>
        <div className={styles.header}>
          <span className={styles.icon}>🤖</span>
          <span className={styles.title}>ML Analysis</span>
          <span className={styles.badgeUnavailable}>Unavailable</span>
        </div>
        <p className={styles.unavailableText}>
          ML models not loaded. Run <code>npm run train</code> in the backend to enable ML-powered analysis.
        </p>
      </div>
    );
  }

  const scamLevel =
    mlInsight.scamProbability >= 60 ? 'high' :
    mlInsight.scamProbability >= 30 ? 'medium' : 'low';

  const anomalyLevel =
    mlInsight.anomalyScore >= 60 ? 'high' :
    mlInsight.anomalyScore >= 30 ? 'medium' : 'low';

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.icon}>🤖</span>
        <span className={styles.title}>ML Analysis</span>
        <span className={`${styles.badge} ${styles[`badge_${scamLevel}`]}`}>
          {mlInsight.scamProbability}% scam probability
        </span>
      </div>

      <div className={styles.gauges}>
        {/* Scam Probability Gauge */}
        <div className={styles.gauge}>
          <div className={styles.gaugeLabel}>Scam Probability</div>
          <div className={styles.gaugeBarBg}>
            <div
              className={`${styles.gaugeBarFill} ${styles[`fill_${scamLevel}`]}`}
              style={{ width: `${mlInsight.scamProbability}%` }}
            />
          </div>
          <div className={styles.gaugeValue}>{mlInsight.scamProbability}%</div>
        </div>

        {/* Anomaly Score Gauge */}
        <div className={styles.gauge}>
          <div className={styles.gaugeLabel}>Anomaly Score</div>
          <div className={styles.gaugeBarBg}>
            <div
              className={`${styles.gaugeBarFill} ${styles[`fill_${anomalyLevel}`]}`}
              style={{ width: `${mlInsight.anomalyScore}%` }}
            />
          </div>
          <div className={styles.gaugeValue}>{mlInsight.anomalyScore}%</div>
        </div>

        {/* Confidence */}
        <div className={styles.gauge}>
          <div className={styles.gaugeLabel}>Model Confidence</div>
          <div className={styles.gaugeBarBg}>
            <div
              className={`${styles.gaugeBarFill} ${styles.fill_confidence}`}
              style={{ width: `${Math.round(mlInsight.confidence * 100)}%` }}
            />
          </div>
          <div className={styles.gaugeValue}>{Math.round(mlInsight.confidence * 100)}%</div>
        </div>
      </div>

      {/* Top Contributing Features */}
      {mlInsight.topFeatures.length > 0 && (
        <div className={styles.features}>
          <div className={styles.featuresTitle}>Top Contributing Factors</div>
          <div className={styles.featureList}>
            {mlInsight.topFeatures.map((f, i) => (
              <div key={i} className={styles.featureItem}>
                <span className={styles.featureName}>
                  {FEATURE_LABELS[f.name] || f.name}
                </span>
                <div className={styles.featureBarBg}>
                  <div
                    className={styles.featureBarFill}
                    style={{ width: `${Math.min(100, f.contribution)}%` }}
                  />
                </div>
                <span className={styles.featureValue}>{f.contribution}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
