'use client';

import { useEffect, useState } from 'react';
import type { RiskLevel } from '@shared/types';
import styles from './RiskGauge.module.css';

interface RiskGaugeProps {
  score: number;
  level: RiskLevel;
}

const RISK_COLORS: Record<RiskLevel, string> = {
  low: '#14f195',
  medium: '#f0b429',
  high: '#ff4757',
};

export default function RiskGauge({ score, level }: RiskGaugeProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Animated count-up
  useEffect(() => {
    setMounted(true);
    let start = 0;
    const duration = 1500;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * score);
      setDisplayScore(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [score]);

  const color = RISK_COLORS[level];

  // SVG arc calculations
  const radius = 85;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75; // 270 degrees
  const fillLength = mounted ? arcLength * (score / 100) : 0;
  const dashOffset = arcLength - fillLength;

  return (
    <div className={styles.container} id="risk-gauge">
      <div className={styles.gaugeWrapper}>
        <svg className={styles.gaugeSvg} viewBox="0 0 200 200">
          {/* Track */}
          <circle
            className={styles.gaugeTrack}
            cx="100"
            cy="100"
            r={radius}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset="0"
            transform="rotate(135 100 100)"
          />
          {/* Fill */}
          <circle
            className={styles.gaugeFill}
            cx="100"
            cy="100"
            r={radius}
            stroke={color}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={dashOffset}
            transform="rotate(135 100 100)"
            style={{ '--gauge-color': `${color}80` } as React.CSSProperties}
          />
        </svg>

        <div className={styles.scoreDisplay}>
          <div className={styles.scoreValue} style={{ color }}>
            {displayScore}
          </div>
          <div className={styles.scoreLabel}>Risk Score</div>
        </div>
      </div>

      <span className={`${styles.riskBadge} ${styles[level]}`}>
        {level} risk
      </span>
    </div>
  );
}
