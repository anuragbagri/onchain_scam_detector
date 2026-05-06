/**
 * ML Scorer — runs inference using pre-trained models
 * and produces anomaly + scam probability scores.
 */

import * as tf from '@tensorflow/tfjs';
import { loadModels } from './models';
import { FEATURE_NAMES } from './featureExtractor';

export interface MLScore {
  anomalyScore: number;       // 0–100 from autoencoder reconstruction error
  scamProbability: number;    // 0–100 from classifier
  combinedMLScore: number;    // weighted blend
  confidence: number;         // 0–1 model confidence
  topFeatures: { name: string; contribution: number }[];
}

// Singleton model instances
let autoencoder: tf.LayersModel | null = null;
let classifier: tf.LayersModel | null = null;
let modelsLoaded = false;
let loadAttempted = false;

/**
 * Initialize ML models (call once at startup).
 */
export async function initML(): Promise<boolean> {
  if (loadAttempted) return modelsLoaded;
  loadAttempted = true;

  try {
    const models = await loadModels();
    autoencoder = models.autoencoder;
    classifier = models.classifier;
    modelsLoaded = autoencoder !== null && classifier !== null;
    console.log(`[ML] Models ${modelsLoaded ? 'loaded ✅' : 'not available ⚠️'}`);
  } catch (err) {
    console.warn('[ML] Failed to initialize models:', err);
    modelsLoaded = false;
  }

  return modelsLoaded;
}

export function isMLReady(): boolean {
  return modelsLoaded;
}

/**
 * Compute ML-based risk scores from a feature vector.
 * Returns null if models aren't loaded.
 */
export async function computeMLScore(features: number[]): Promise<MLScore | null> {
  if (!modelsLoaded || !autoencoder || !classifier) {
    return null;
  }

  const inputTensor = tf.tensor2d([features]);

  try {
    // ── Autoencoder: anomaly detection ─────────────────────────
    const reconstructed = autoencoder.predict(inputTensor) as tf.Tensor;
    const mse = tf.losses.meanSquaredError(inputTensor, reconstructed);
    const reconstructionError = (await mse.data())[0];

    // Normalize error to 0–100 scale
    // Based on training: normal samples have error ~0.001–0.01, anomalies ~0.05–0.2
    const anomalyScore = Math.min(100, Math.round(
      Math.min(1, reconstructionError / 0.08) * 100
    ));

    reconstructed.dispose();
    mse.dispose();

    // ── Classifier: scam probability ──────────────────────────
    const prediction = classifier.predict(inputTensor) as tf.Tensor;
    const scamProb = (await prediction.data())[0];
    const scamProbability = Math.round(scamProb * 100);

    prediction.dispose();

    // ── Feature importance (perturbation-based) ───────────────
    const topFeatures = await computeFeatureImportance(features, classifier);

    // ── Combined score ────────────────────────────────────────
    // 60% classifier + 40% autoencoder anomaly
    const combinedMLScore = Math.round(
      scamProbability * 0.6 + anomalyScore * 0.4
    );

    // Confidence based on how decisive the classifier is
    // (close to 0 or 1 = high confidence, close to 0.5 = low)
    const confidence = Math.abs(scamProb - 0.5) * 2; // 0–1

    return {
      anomalyScore,
      scamProbability,
      combinedMLScore,
      confidence,
      topFeatures,
    };
  } finally {
    inputTensor.dispose();
  }
}

/**
 * Simple perturbation-based feature importance.
 * For each feature, zero it out and measure prediction change.
 * Returns top 5 most influential features.
 */
async function computeFeatureImportance(
  features: number[],
  model: tf.LayersModel
): Promise<{ name: string; contribution: number }[]> {
  const baseTensor = tf.tensor2d([features]);
  const basePred = (await (model.predict(baseTensor) as tf.Tensor).data())[0];
  baseTensor.dispose();

  const importances: { name: string; contribution: number }[] = [];

  for (let i = 0; i < features.length; i++) {
    const perturbed = [...features];
    perturbed[i] = 0; // Zero out this feature

    const perturbedTensor = tf.tensor2d([perturbed]);
    const perturbedPred = (await (model.predict(perturbedTensor) as tf.Tensor).data())[0];
    perturbedTensor.dispose();

    const change = Math.abs(basePred - perturbedPred);
    importances.push({
      name: FEATURE_NAMES[i],
      contribution: Math.round(change * 100),
    });
  }

  // Return top 5 sorted by impact
  return importances
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 5)
    .filter(f => f.contribution > 0);
}
