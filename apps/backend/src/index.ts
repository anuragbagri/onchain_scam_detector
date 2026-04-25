import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import analyzeRouter from './routes/analyze';
import { errorHandler } from './middleware/errorHandler';
import { checkConnection } from './services/solana';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/health', async (_req, res) => {
  const solanaOk = await checkConnection();
  res.json({
    status: solanaOk ? 'ok' : 'degraded',
    solana: solanaOk ? 'connected' : 'unreachable',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', analyzeRouter);

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(port, () => {
  console.log(`\n🛡️  Scam Detector Backend running at http://localhost:${port}`);
  console.log(`   Health: http://localhost:${port}/health`);
  console.log(`   Analyze: POST http://localhost:${port}/api/analyze\n`);
});
