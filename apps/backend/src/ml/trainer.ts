/**
 * Model Trainer — trains autoencoder and classifier from generated data.
 * Run with: npx ts-node src/ml/trainer.ts
 */

import * as tf from '@tensorflow/tfjs';
// Using custom JSON-based model save/load (no native tfjs-node needed)

import { generateTrainingData } from './trainingData';
import { createAutoencoder, createClassifier, saveModels } from './models';
import { FEATURE_DIM } from './featureExtractor';

async function train(): Promise<void> {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║   🧠 Scam Detector ML — Training Pipeline ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log(`Feature dimension: ${FEATURE_DIM}`);

  // 1. Generate training data
  const data = generateTrainingData();
  const legitSamples = data.filter(s => s.label === 0);
  const allFeatures = data.map(s => s.features);
  const allLabels = data.map(s => s.label);
  const legitFeatures = legitSamples.map(s => s.features);

  // 2. Train autoencoder (legit samples only)
  console.log('\n─── Training Autoencoder (anomaly detection) ───');
  const autoencoder = createAutoencoder();
  const aeXTrain = tf.tensor2d(legitFeatures);

  await autoencoder.fit(aeXTrain, aeXTrain, {
    epochs: 100,
    batchSize: 32,
    validationSplit: 0.2,
    verbose: 0,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        if (epoch % 20 === 0 || epoch === 99) {
          console.log(`  Epoch ${epoch + 1}: loss=${logs?.loss?.toFixed(5)}, val_loss=${logs?.val_loss?.toFixed(5)}`);
        }
      },
    },
  });
  aeXTrain.dispose();

  // Compute anomaly threshold from training data
  const aeTrainPred = autoencoder.predict(tf.tensor2d(legitFeatures)) as tf.Tensor;
  const aeErrors = tf.losses.meanSquaredError(tf.tensor2d(legitFeatures), aeTrainPred);
  const errorValues = await aeErrors.data();
  const meanError = Array.from(errorValues).reduce((a, b) => a + b, 0) / errorValues.length;
  const maxError = Math.max(...Array.from(errorValues));
  console.log(`  Anomaly threshold — mean: ${meanError.toFixed(5)}, max: ${maxError.toFixed(5)}`);
  aeTrainPred.dispose();
  aeErrors.dispose();

  // 3. Train classifier (all labeled data)
  console.log('\n─── Training Binary Classifier (scam detection) ───');
  const classifier = createClassifier();
  const clXTrain = tf.tensor2d(allFeatures);
  const clYTrain = tf.tensor2d(allLabels.map(l => [l]));

  await classifier.fit(clXTrain, clYTrain, {
    epochs: 100,
    batchSize: 32,
    validationSplit: 0.2,
    verbose: 0,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        if (epoch % 20 === 0 || epoch === 99) {
          console.log(`  Epoch ${epoch + 1}: loss=${logs?.loss?.toFixed(4)}, acc=${logs?.acc?.toFixed(4)}, val_acc=${logs?.val_acc?.toFixed(4)}`);
        }
      },
    },
  });
  clXTrain.dispose();
  clYTrain.dispose();

  // 4. Evaluate classifier
  console.log('\n─── Evaluation ───');
  const evalX = tf.tensor2d(allFeatures);
  const evalPred = classifier.predict(evalX) as tf.Tensor;
  const predictions = await evalPred.data();

  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (let i = 0; i < allLabels.length; i++) {
    const pred = predictions[i] > 0.5 ? 1 : 0;
    if (pred === 1 && allLabels[i] === 1) tp++;
    else if (pred === 1 && allLabels[i] === 0) fp++;
    else if (pred === 0 && allLabels[i] === 0) tn++;
    else fn++;
  }

  const precision = tp / (tp + fp) || 0;
  const recall = tp / (tp + fn) || 0;
  const f1 = 2 * (precision * recall) / (precision + recall) || 0;
  const accuracy = (tp + tn) / allLabels.length;

  console.log(`  Accuracy:  ${(accuracy * 100).toFixed(1)}%`);
  console.log(`  Precision: ${(precision * 100).toFixed(1)}%`);
  console.log(`  Recall:    ${(recall * 100).toFixed(1)}%`);
  console.log(`  F1 Score:  ${(f1 * 100).toFixed(1)}%`);
  console.log(`  Confusion: TP=${tp} FP=${fp} TN=${tn} FN=${fn}`);

  evalX.dispose();
  evalPred.dispose();

  // 5. Save models
  console.log('\n─── Saving Models ───');
  await saveModels(autoencoder, classifier);

  console.log('\n✅ Training complete! Models saved to apps/backend/models/');
}

train().catch(err => {
  console.error('Training failed:', err);
  process.exit(1);
});
