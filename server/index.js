// ============================================
// CRITICAL: Load dotenv BEFORE any other imports
// This ensures process.env is populated when other
// modules are loaded (ES modules are hoisted)
// ============================================
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import sessionsRouter from './routes/sessions.js';
import decisionsRouter from './routes/decisions.js';
import personasRouter from './routes/personas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load non-sensitive config from JSON
let config = { personas: {} };
try {
  config = JSON.parse(readFileSync(join(__dirname, '../config/config.json'), 'utf-8'));
} catch (error) {
  console.warn('Warning: Could not load config.json, using defaults');
}

const app = express();

// Use environment variables for server settings (with fallback defaults)
const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// Middleware
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '10mb' }));

// Serve frontend static files
app.use(express.static(join(__dirname, '../frontend')));

// API Routes
app.use('/api/sessions', sessionsRouter);
app.use('/api/decisions', decisionsRouter);
app.use('/api/personas', personasRouter);

// Health check endpoint (useful for verifying configuration)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    config: {
      port: PORT,
      model: process.env.LLM_MODEL || 'gpt-5.2',
      reasoningEffort: process.env.LLM_REASONING_EFFORT || 'medium',
      dbPath: process.env.DB_PATH || './data/board.db',
      // Never expose API key, just show if it's configured
      apiKeyConfigured: !!process.env.OPENAI_API_KEY
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Personal Board server running at http://localhost:${PORT}`);
  console.log(`Model: ${process.env.LLM_MODEL || 'gpt-5.2'}`);
  console.log(`API Key: ${process.env.OPENAI_API_KEY ? 'Configured' : 'NOT CONFIGURED - check .env file!'}`);
});
