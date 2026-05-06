/**
 * ML Model Definitions — TensorFlow.js autoencoder and binary classifier
 * for on-chain scam detection.
 *
 * Uses pure @tensorflow/tfjs with custom JSON-based model persistence
 * (no native tfjs-node bindings needed).
 */

import * as tf from '@tensorflow/tfjs';
import { FEATURE_DIM } from './featureExtractor';
import * as fs from 'fs';
import * as path from 'path';

// In dev: cwd = apps/backend, models at ./models
// In prod: cwd = apps/backend (or project root), we check both
const MODELS_DIR = fs.existsSync(path.join(process.cwd(), 'models'))
  ? path.join(process.cwd(), 'models')
  : fs.existsSync(path.join(process.cwd(), 'apps/backend/models'))
    ? path.join(process.cwd(), 'apps/backend/models')
    : path.join(__dirname, '../../models');

/**
 * Create the autoencoder model.
 * Architecture: 18 → 12 → 6 → 12 → 18
 * Trained on legitimate patterns only — anomalies produce high reconstruction error.
 */
export function createAutoencoder(): tf.LayersModel {
  const model = tf.sequential();

  // Encoder
  model.add(tf.layers.dense({
    units: 12,
    inputShape: [FEATURE_DIM],
    activation: 'relu',
    kernelInitializer: 'glorotUniform',
  }));
  model.add(tf.layers.dense({
    units: 6,
    activation: 'relu',
  }));

  // Decoder
  model.add(tf.layers.dense({
    units: 12,
    activation: 'relu',
  }));
  model.add(tf.layers.dense({
    units: FEATURE_DIM,
    activation: 'sigmoid',
  }));

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'meanSquaredError',
  });

  return model;
}

/**
 * Create the binary classifier model.
 * Architecture: 18 → 32 → dropout → 16 → 1 (sigmoid)
 * Outputs scam probability 0–1.
 */
export function createClassifier(): tf.LayersModel {
  const model = tf.sequential();

  model.add(tf.layers.dense({
    units: 32,
    inputShape: [FEATURE_DIM],
    activation: 'relu',
    kernelInitializer: 'glorotUniform',
  }));
  model.add(tf.layers.dropout({ rate: 0.3 }));
  model.add(tf.layers.dense({
    units: 16,
    activation: 'relu',
  }));
  model.add(tf.layers.dense({
    units: 1,
    activation: 'sigmoid',
  }));

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'binaryCrossentropy',
    metrics: ['accuracy'],
  });

  return model;
}

// ── Weights-only persistence ───────────────────────────────────
// Since architecture is defined in code, we only serialize weights.

interface SerializedWeights {
  weights: Array<{ shape: number[]; data: number[] }>;
}

/**
 * Save just the weights to a JSON file.
 */
async function saveWeightsToFile(model: tf.LayersModel, filePath: string): Promise<void> {
  const weights = model.getWeights();
  const serialized: SerializedWeights = { weights: [] };

  for (const w of weights) {
    const data = await w.data();
    serialized.weights.push({
      shape: w.shape as number[],
      data: Array.from(data as Float32Array),
    });
  }

  fs.writeFileSync(filePath, JSON.stringify(serialized));
}

/**
 * Load weights from a JSON file into an existing model.
 */
function loadWeightsFromFile(model: tf.LayersModel, filePath: string): void {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const serialized: SerializedWeights = JSON.parse(raw);

  const weightTensors = serialized.weights.map(w =>
    tf.tensor(w.data, w.shape)
  );
  model.setWeights(weightTensors);
}

/**
 * Load pre-trained models from disk, or return null if not available.
 * Recreates model architecture in code and loads saved weights.
 */
export async function loadModels(): Promise<{
  autoencoder: tf.LayersModel | null;
  classifier: tf.LayersModel | null;
}> {
  let autoencoder: tf.LayersModel | null = null;
  let classifier: tf.LayersModel | null = null;

  const aePath = path.join(MODELS_DIR, 'autoencoder.json');
  const clPath = path.join(MODELS_DIR, 'classifier.json');

  try {
    if (fs.existsSync(aePath)) {
      autoencoder = createAutoencoder();
      loadWeightsFromFile(autoencoder, aePath);
      console.log('[ML] Autoencoder model loaded');
    }
  } catch (err) {
    console.warn('[ML] Failed to load autoencoder:', err);
    autoencoder = null;
  }

  try {
    if (fs.existsSync(clPath)) {
      classifier = createClassifier();
      loadWeightsFromFile(classifier, clPath);
      console.log('[ML] Classifier model loaded');
    }
  } catch (err) {
    console.warn('[ML] Failed to load classifier:', err);
    classifier = null;
  }

  return { autoencoder, classifier };
}

/**
 * Save models to disk (weights only).
 */
export async function saveModels(
  autoencoder: tf.LayersModel,
  classifier: tf.LayersModel
): Promise<void> {
  if (!fs.existsSync(MODELS_DIR)) fs.mkdirSync(MODELS_DIR, { recursive: true });

  const aePath = path.join(MODELS_DIR, 'autoencoder.json');
  const clPath = path.join(MODELS_DIR, 'classifier.json');

  await saveWeightsToFile(autoencoder, aePath);
  console.log(`[ML] Autoencoder saved to ${aePath}`);

  await saveWeightsToFile(classifier, clPath);
  console.log(`[ML] Classifier saved to ${clPath}`);
}

