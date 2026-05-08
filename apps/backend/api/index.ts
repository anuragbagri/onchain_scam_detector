/**
 * Vercel Serverless Function entry point.
 * Wraps the Express app as a serverless handler.
 */

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import analyzeRouter from '../src/routes/analyze';
import { errorHandler } from '../src/middleware/errorHandler';
import { checkConnection } from '../src/services/solana';
import { initML, isMLReady } from '../src/ml/mlScorer';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize ML on first cold start
let mlInitialized = false;
async function ensureML() {
  if (!mlInitialized) {
    await initML();
    mlInitialized = true;
  }
}

// Health endpoint
app.get('/api/health', async (_req, res) => {
  await ensureML();
  const solanaOk = await checkConnection();
  res.json({
    status: solanaOk ? 'ok' : 'degraded',
    solana: solanaOk ? 'connected' : 'unreachable',
    ml: isMLReady() ? 'loaded' : 'unavailable',
    timestamp: new Date().toISOString(),
  });
});

// Also support /health (without /api prefix) for legacy
app.get('/health', async (_req, res) => {
  await ensureML();
  const solanaOk = await checkConnection();
  res.json({
    status: solanaOk ? 'ok' : 'degraded',
    solana: solanaOk ? 'connected' : 'unreachable',
    ml: isMLReady() ? 'loaded' : 'unavailable',
    timestamp: new Date().toISOString(),
  });
});

// ML init middleware for analyze routes
app.use('/api', async (_req, _res, next) => {
  await ensureML();
  next();
});

app.use('/api', analyzeRouter);

// Error handler
app.use(errorHandler);

export default app;
