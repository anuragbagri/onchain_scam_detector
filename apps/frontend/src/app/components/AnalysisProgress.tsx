'use client';

import { useEffect, useState } from 'react';
import styles from './AnalysisProgress.module.css';

const STEPS = [
  { label: 'Connecting to Solana network...', duration: 800 },
  { label: 'Fetching transaction history...', duration: 2000 },
  { label: 'Analyzing on-chain patterns...', duration: 1500 },
  { label: 'Calculating risk score...', duration: 1000 },
];

export default function AnalysisProgress() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    let currentStep = 0;

    const advanceStep = () => {
      if (currentStep < STEPS.length - 1) {
        currentStep++;
        setActiveStep(currentStep);
        timeout = setTimeout(advanceStep, STEPS[currentStep].duration);
      }
    };

    timeout = setTimeout(advanceStep, STEPS[0].duration);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className={styles.container} id="analysis-progress">
      <div className={styles.spinner} />
      <div className={styles.steps}>
        {STEPS.map((step, idx) => {
          const isDone = idx < activeStep;
          const isActive = idx === activeStep;

          return (
            <div
              key={idx}
              className={`${styles.step} ${isDone ? styles.stepDone : ''} ${isActive ? styles.stepActive : ''}`}
            >
              <span
                className={`${styles.stepIcon} ${
                  isDone
                    ? ''
                    : isActive
                    ? styles.stepIconActive
                    : styles.stepIconPending
                }`}
              >
                {isDone ? '✓' : isActive ? '●' : '○'}
              </span>
              <span className={styles.stepLabel}>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
