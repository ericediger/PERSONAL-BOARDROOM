# BUILD.md — Local Setup Guide

## Quick Start (5 minutes)

```bash
# 1. Clone/create the project directory
mkdir personal-board && cd personal-board

# 2. Copy the config template and add your API key
cp config/config.example.json config/config.json
# Edit config/config.json with your API key

# 3. Install dependencies
npm install

# 4. Initialize the database
npm run db:init

# 5. Start the server
npm run dev

# 6. Open the frontend
open frontend/index.html
# (or just double-click the HTML file in your file browser)
```

---

## Prerequisites

- **Node.js 18+** (or Python 3.10+ if using FastAPI)
- **An LLM API key** (Anthropic, OpenAI, or compatible)
- **A modern browser** (Chrome, Firefox, Safari, Edge)

---

## Project Structure Setup

Create the following directory structure:

```bash
mkdir -p personal-board/{config,frontend/{css,js},server/{routes,services,prompts,db},data}
cd personal-board
```

---

## Step 1: Configuration

### Create `config/config.example.json`

```json
{
  "llm": {
    "provider": "openai",
    "api_key": "YOUR_OPENAI_API_KEY_HERE",
    "model": "gpt-5.2",
    "max_tokens": 4096,
    "reasoning_effort": "medium",
    "verbosity": "medium"
  },
  "database": {
    "path": "./data/board.db"
  },
  "server": {
    "port": 3000,
    "cors_origin": "*"
  },
  "personas": {
    "parallel_calls": true,
    "retry_attempts": 3,
    "cache_ttl_seconds": 3600,
    "reasoning_overrides": {
      "strategist": "high",
      "contrarian": "high",
      "operator": "medium",
      "finance": "medium",
      "craft-expert": "medium",
      "secretary": "low"
    }
  }
}
```

### GPT-5.2 Configuration Notes

| Parameter | Values | Description |
|-----------|--------|-------------|
| `model` | `gpt-5.2`, `gpt-5.2-pro` | GPT-5.2 is recommended; Pro uses more compute for harder problems |
| `reasoning_effort` | `none`, `minimal`, `low`, `medium`, `high`, `xhigh` | Controls reasoning depth. Higher = better quality but slower/costlier |
| `verbosity` | `low`, `medium`, `high` | Controls response length and detail |
| `reasoning_overrides` | Per-persona settings | Override reasoning effort for specific personas |

**Reasoning Effort Guidelines:**
- `none` / `minimal`: Fast, cheap — use for simple extraction/classification
- `low`: Light reasoning — good for the Secretary
- `medium`: Balanced — good default for most board members
- `high`: Deep reasoning — recommended for Strategist and Contrarian
- `xhigh`: Maximum reasoning — for critical decisions (GPT-5.2 only)
```

### Create your actual config

```bash
cp config/config.example.json config/config.json
# Now edit config/config.json and add your real API key
```

**Important:** Add `config/config.json` to `.gitignore` to protect your API key.

---

## Step 2: Database Schema

### Create `server/db/schema.sql`

```sql
-- Personas table (the 6 board members)
CREATE TABLE IF NOT EXISTS personas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    description TEXT,
    system_prompt TEXT NOT NULL,
    output_schema TEXT,  -- JSON schema for validation
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table (one per board meeting)
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    status TEXT DEFAULT 'draft',  -- draft, running, complete, archived
    category TEXT,  -- career, project, finance
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    completed_at TEXT
);

-- Memos table (Chair's input)
CREATE TABLE IF NOT EXISTS memos (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    context TEXT,  -- JSON array
    decision_required TEXT NOT NULL,
    options TEXT,  -- JSON array
    constraints TEXT,  -- JSON object
    success_metrics TEXT,  -- JSON array
    questions_for_board TEXT,  -- JSON array
    attachments TEXT,  -- JSON array
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Responses table (each persona's response)
CREATE TABLE IF NOT EXISTS responses (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    persona_id TEXT NOT NULL,
    position TEXT,
    top_reasons TEXT,  -- JSON array
    top_risks TEXT,  -- JSON array
    recommended_modifications TEXT,  -- JSON array
    validation_metrics TEXT,  -- JSON object
    confidence TEXT,  -- low, medium, high
    raw_analysis TEXT,
    tokens_used INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id),
    FOREIGN KEY (persona_id) REFERENCES personas(id)
);

-- Decisions table (finalized outcomes)
CREATE TABLE IF NOT EXISTS decisions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL UNIQUE,
    decision_statement TEXT NOT NULL,
    rationale TEXT,
    execution_guardrails TEXT,  -- JSON array
    pre_mortem TEXT,  -- JSON object
    assumption_to_test TEXT,
    review_date TEXT,
    outcome TEXT,  -- filled in later
    retrospective TEXT,  -- filled in later
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Actions table (next steps from each session)
CREATE TABLE IF NOT EXISTS actions (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    decision_id TEXT,
    action TEXT NOT NULL,
    owner TEXT DEFAULT 'Chair',
    due_date TEXT,
    status TEXT DEFAULT 'open',  -- open, in_progress, complete, cancelled
    completed_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id),
    FOREIGN KEY (decision_id) REFERENCES decisions(id)
);

-- Tags table (for categorization and search)
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_category ON sessions(category);
CREATE INDEX IF NOT EXISTS idx_responses_session ON responses(session_id);
CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status);
CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag);
```

### Initialize the database

```bash
# Using sqlite3 directly
sqlite3 data/board.db < server/db/schema.sql

# Or via npm script (see package.json below)
npm run db:init
```

---

## Step 3: Package Setup

### Create `package.json`

```json
{
  "name": "personal-board",
  "version": "1.0.0",
  "description": "Personal Board of Directors - AI-powered decision support",
  "main": "server/index.js",
  "type": "module",
  "scripts": {
    "dev": "node --watch server/index.js",
    "start": "node server/index.js",
    "db:init": "sqlite3 data/board.db < server/db/schema.sql",
    "db:reset": "rm -f data/board.db && npm run db:init",
    "test:prompts": "node server/tests/prompt-tests.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "better-sqlite3": "^9.4.3",
    "uuid": "^9.0.0"
  },
  "devDependencies": {}
}
```

### Install dependencies

```bash
npm install
```

---

## Step 4: Server Implementation

### Create `server/index.js`

```javascript
import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import sessionsRouter from './routes/sessions.js';
import decisionsRouter from './routes/decisions.js';
import personasRouter from './routes/personas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(__dirname, '../config/config.json'), 'utf-8'));

const app = express();

// Middleware
app.use(cors({ origin: config.server.cors_origin }));
app.use(express.json({ limit: '10mb' }));

// API Routes
app.use('/api/sessions', sessionsRouter);
app.use('/api/decisions', decisionsRouter);
app.use('/api/personas', personasRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
const PORT = config.server.port || 3000;
app.listen(PORT, () => {
  console.log(`🎯 Personal Board server running at http://localhost:${PORT}`);
  console.log(`📂 Open frontend/index.html in your browser to start`);
});
```

### Create `server/db/db.js`

```javascript
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(__dirname, '../../config/config.json'), 'utf-8'));

const db = new Database(config.database.path);
db.pragma('journal_mode = WAL');

export default db;
```

### Create `server/services/llm-client.js`

This client uses the **OpenAI Responses API** (`POST /v1/responses`) which is recommended for GPT-5 series models. It supports reasoning effort levels, structured outputs via JSON schemas, and verbosity controls.

```javascript
/**
 * LLM Client for OpenAI GPT-5.2 Responses API
 * 
 * Uses the Responses API (POST /v1/responses) which is recommended for GPT-5 series models.
 * Supports reasoning effort levels, structured outputs, and verbosity controls.
 * 
 * Reference: https://platform.openai.com/docs/guides/latest-model
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(__dirname, '../../config/config.json'), 'utf-8'));

/**
 * Reasoning effort levels for GPT-5.2:
 * - none: No reasoning tokens (fastest, cheapest)
 * - minimal: Very few reasoning tokens
 * - low: Light reasoning
 * - medium: Balanced (default)
 * - high: Deep reasoning
 * - xhigh: Maximum reasoning (GPT-5.2 only)
 */
const REASONING_EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh'];

export class LLMClient {
  constructor(options = {}) {
    this.apiKey = options.apiKey || config.llm.api_key;
    this.model = options.model || config.llm.model || 'gpt-5.2';
    this.maxTokens = options.maxTokens || config.llm.max_tokens || 4096;
    this.reasoningEffort = options.reasoningEffort || config.llm.reasoning_effort || 'medium';
    this.verbosity = options.verbosity || config.llm.verbosity || 'medium';
    this.baseUrl = options.baseUrl || 'https://api.openai.com/v1';
  }

  /**
   * Make a completion request using the Responses API
   * 
   * @param {string} instructions - System-level instructions
   * @param {string|Array} input - User message(s)
   * @param {Object} options - Additional options
   * @param {Object} options.jsonSchema - JSON schema for structured output
   * @param {string} options.reasoningEffort - Override reasoning effort
   * @param {string} options.verbosity - Override verbosity
   * @returns {Promise<Object>} - { parsed, raw, tokens }
   */
  async complete(instructions, input, options = {}) {
    const {
      jsonSchema = null,
      reasoningEffort = this.reasoningEffort,
      verbosity = this.verbosity,
      includeReasoning = false
    } = options;

    // Build the request body for Responses API
    const body = {
      model: this.model,
      max_output_tokens: this.maxTokens,
      
      // Instructions replace the old "system" message
      instructions: instructions,
      
      // Input can be a string or array of message objects
      input: typeof input === 'string' 
        ? [{ role: 'user', content: input }]
        : input,
      
      // Reasoning configuration
      reasoning: {
        effort: reasoningEffort,
        ...(includeReasoning && { summary: 'auto' })
      },
      
      // Verbosity control
      text: {
        verbosity: verbosity
      }
    };

    // Add structured output format if JSON schema provided
    if (jsonSchema) {
      body.text.format = {
        type: 'json_schema',
        strict: true,
        name: jsonSchema.name || 'response_schema',
        schema: jsonSchema.schema || jsonSchema
      };
    }

    const response = await fetch(`${this.baseUrl}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI Responses API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return this.parseResponse(data, jsonSchema);
  }

  /**
   * Parse the Responses API response
   */
  parseResponse(data, expectJson = false) {
    // Use output_text helper if available, otherwise extract from output array
    let rawText = data.output_text || '';
    
    if (!rawText && data.output && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.type === 'message' && item.content) {
          for (const content of item.content) {
            if (content.type === 'output_text' || content.type === 'text') {
              rawText += content.text || '';
            }
          }
        }
      }
    }

    const tokens = {
      input: data.usage?.input_tokens || 0,
      output: data.usage?.output_tokens || 0,
      reasoning: data.usage?.output_tokens_details?.reasoning_tokens || 0,
      total: data.usage?.total_tokens || 0
    };

    let parsed = null;
    if (expectJson && rawText) {
      try {
        const jsonMatch = rawText.match(/```json\n?([\s\S]*?)\n?```/) || 
                          rawText.match(/```\n?([\s\S]*?)\n?```/);
        const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawText.trim();
        parsed = JSON.parse(jsonStr);
      } catch (e) {
        console.warn('Failed to parse JSON from response:', e.message);
      }
    }

    return { parsed, raw: rawText, tokens, responseId: data.id };
  }

  /**
   * Run multiple completions in parallel
   */
  async completeParallel(requests) {
    return Promise.all(
      requests.map(({ instructions, input, options }) => 
        this.complete(instructions, input, options)
      )
    );
  }

  /**
   * Complete with retry logic
   */
  async completeWithRetry(instructions, input, options = {}, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.complete(instructions, input, options);
      } catch (error) {
        lastError = error;
        console.warn(`Attempt ${attempt}/${maxRetries} failed:`, error.message);
        
        if (error.message.includes('(4')) throw error; // Don't retry 4xx
        
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }
    }
    throw lastError;
  }
}

export default new LLMClient();
```

---

## Step 5: Basic Routes

### Create `server/routes/sessions.js`

```javascript
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/db.js';
import { runBoardMeeting } from '../services/orchestrator.js';

const router = Router();

// Create new session
router.post('/', (req, res) => {
  const id = uuidv4();
  const { category } = req.body;
  
  db.prepare(`
    INSERT INTO sessions (id, category, status)
    VALUES (?, ?, 'draft')
  `).run(id, category || 'project');
  
  res.json({ id, status: 'draft', category });
});

// Get session by ID
router.get('/:id', (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  
  const memo = db.prepare('SELECT * FROM memos WHERE session_id = ?').get(req.params.id);
  const responses = db.prepare('SELECT * FROM responses WHERE session_id = ?').all(req.params.id);
  const decision = db.prepare('SELECT * FROM decisions WHERE session_id = ?').get(req.params.id);
  const actions = db.prepare('SELECT * FROM actions WHERE session_id = ?').all(req.params.id);
  
  res.json({ session, memo, responses, decision, actions });
});

// Save memo to session
router.post('/:id/memo', (req, res) => {
  const { id } = req.params;
  const memo = req.body;
  const memoId = uuidv4();
  
  // Delete existing memo if any
  db.prepare('DELETE FROM memos WHERE session_id = ?').run(id);
  
  db.prepare(`
    INSERT INTO memos (id, session_id, context, decision_required, options, constraints, success_metrics, questions_for_board, attachments)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    memoId,
    id,
    JSON.stringify(memo.context || []),
    memo.decision_required,
    JSON.stringify(memo.options || []),
    JSON.stringify(memo.constraints || {}),
    JSON.stringify(memo.success_metrics || []),
    JSON.stringify(memo.questions_for_board || []),
    JSON.stringify(memo.attachments || [])
  );
  
  res.json({ id: memoId, session_id: id });
});

// Run the board meeting
router.post('/:id/run', async (req, res) => {
  try {
    const result = await runBoardMeeting(req.params.id);
    res.json(result);
  } catch (error) {
    console.error('Board meeting error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Finalize decision
router.post('/:id/decision', (req, res) => {
  const { id } = req.params;
  const decision = req.body;
  const decisionId = uuidv4();
  
  db.prepare(`
    INSERT INTO decisions (id, session_id, decision_statement, rationale, execution_guardrails, pre_mortem, assumption_to_test, review_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    decisionId,
    id,
    decision.decision_statement,
    decision.rationale,
    JSON.stringify(decision.execution_guardrails || []),
    JSON.stringify(decision.pre_mortem || {}),
    decision.assumption_to_test,
    decision.review_date
  );
  
  // Update session status
  db.prepare(`UPDATE sessions SET status = 'complete', completed_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
  
  res.json({ id: decisionId, session_id: id });
});

// List all sessions
router.get('/', (req, res) => {
  const { status, category, limit = 20 } = req.query;
  let query = 'SELECT * FROM sessions WHERE 1=1';
  const params = [];
  
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  
  const sessions = db.prepare(query).all(...params);
  res.json(sessions);
});

export default router;
```

### Create `server/routes/decisions.js`

```javascript
import { Router } from 'express';
import db from '../db/db.js';

const router = Router();

// Get all decisions
router.get('/', (req, res) => {
  const { tag, q, limit = 50 } = req.query;
  
  let query = `
    SELECT d.*, s.category 
    FROM decisions d
    JOIN sessions s ON d.session_id = s.id
    WHERE 1=1
  `;
  const params = [];
  
  if (q) {
    query += ' AND (d.decision_statement LIKE ? OR d.rationale LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  
  query += ' ORDER BY d.created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  
  const decisions = db.prepare(query).all(...params);
  res.json(decisions);
});

// Update decision outcome (retrospective)
router.patch('/:id', (req, res) => {
  const { outcome, retrospective } = req.body;
  
  db.prepare(`
    UPDATE decisions SET outcome = ?, retrospective = ? WHERE id = ?
  `).run(outcome, retrospective, req.params.id);
  
  res.json({ success: true });
});

export default router;
```

### Create `server/routes/personas.js`

```javascript
import { Router } from 'express';
import db from '../db/db.js';

const router = Router();

// Get all personas
router.get('/', (req, res) => {
  const personas = db.prepare('SELECT * FROM personas WHERE is_active = 1').all();
  res.json(personas);
});

// Get persona by ID
router.get('/:id', (req, res) => {
  const persona = db.prepare('SELECT * FROM personas WHERE id = ?').get(req.params.id);
  if (!persona) return res.status(404).json({ error: 'Persona not found' });
  res.json(persona);
});

// Update persona
router.patch('/:id', (req, res) => {
  const { system_prompt, output_schema, is_active } = req.body;
  
  if (system_prompt !== undefined) {
    db.prepare('UPDATE personas SET system_prompt = ? WHERE id = ?').run(system_prompt, req.params.id);
  }
  if (output_schema !== undefined) {
    db.prepare('UPDATE personas SET output_schema = ? WHERE id = ?').run(output_schema, req.params.id);
  }
  if (is_active !== undefined) {
    db.prepare('UPDATE personas SET is_active = ? WHERE id = ?').run(is_active ? 1 : 0, req.params.id);
  }
  
  res.json({ success: true });
});

export default router;
```

---

## Step 6: Create the Orchestrator

### Create `server/services/orchestrator.js`

The orchestrator runs the full board meeting using the GPT-5.2 Responses API with per-persona reasoning levels.

```javascript
/**
 * Board Meeting Orchestrator
 * Uses OpenAI GPT-5.2 Responses API with configurable reasoning effort per persona.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/db.js';
import { LLMClient } from './llm-client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(__dirname, '../../config/config.json'), 'utf-8'));

const llm = new LLMClient();

function loadPrompt(filename) {
  return readFileSync(join(__dirname, '../prompts', filename), 'utf-8');
}

function getReasoningEffort(personaId) {
  const overrides = config.personas?.reasoning_overrides || {};
  return overrides[personaId] || config.llm?.reasoning_effort || 'medium';
}

// JSON schemas for structured outputs (enforced by GPT-5.2)
const SCHEMAS = {
  board_member: {
    name: 'board_member_output',
    schema: {
      type: 'object',
      properties: {
        position: { type: 'string' },
        top_reasons: { type: 'array', items: { type: 'string' } },
        top_risks: { type: 'array', items: { type: 'string' } },
        recommended_modifications: { type: 'array', items: { type: 'string' } },
        validation_metrics: {
          type: 'object',
          properties: {
            '30_day': { type: 'array', items: { type: 'string' } },
            '90_day': { type: 'array', items: { type: 'string' } }
          },
          required: ['30_day', '90_day'],
          additionalProperties: false
        },
        confidence: { type: 'string', enum: ['low', 'medium', 'high'] }
      },
      required: ['position', 'top_reasons', 'top_risks', 'confidence'],
      additionalProperties: false
    }
  },
  strategist: {
    name: 'strategist_synthesis',
    schema: {
      type: 'object',
      properties: {
        integrated_recommendation: {
          type: 'object',
          properties: {
            decision: { type: 'string' },
            rationale: { type: 'string' },
            reversibility: { type: 'string', enum: ['high', 'medium', 'low'] }
          },
          required: ['decision', 'rationale', 'reversibility'],
          additionalProperties: false
        },
        agreement_areas: { type: 'array', items: { type: 'string' } },
        disagreement_areas: { type: 'array', items: { type: 'string' } },
        execution_guardrails: { type: 'array', items: { type: 'string' } },
        next_actions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              action: { type: 'string' },
              owner: { type: 'string' },
              timeframe: { type: 'string' }
            },
            required: ['action', 'owner', 'timeframe'],
            additionalProperties: false
          }
        },
        assumption_to_test: { type: 'string' },
        decision_statement: { type: 'string' }
      },
      required: ['integrated_recommendation', 'next_actions', 'decision_statement'],
      additionalProperties: false
    }
  }
};

export async function runBoardMeeting(sessionId) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎯 BOARD MEETING STARTED - Session: ${sessionId}`);
  console.log(`${'='.repeat(60)}\n`);
  
  db.prepare(`UPDATE sessions SET status = 'running', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(sessionId);
  
  const memo = db.prepare('SELECT * FROM memos WHERE session_id = ?').get(sessionId);
  if (!memo) throw new Error('No memo found for session');
  
  const memoData = {
    context: JSON.parse(memo.context || '[]'),
    decision_required: memo.decision_required,
    options: JSON.parse(memo.options || '[]'),
    constraints: JSON.parse(memo.constraints || '{}'),
    success_metrics: JSON.parse(memo.success_metrics || '[]'),
    questions_for_board: JSON.parse(memo.questions_for_board || '[]')
  };
  
  const memoText = formatMemoForPrompt(memoData);
  
  // PHASE 1: Secretary (low reasoning - just normalization)
  console.log('📋 PHASE 1: Secretary processing memo...');
  const secretaryPrompt = loadPrompt('secretary.txt');
  const secretaryResult = await llm.completeWithRetry(
    secretaryPrompt,
    memoText,
    { reasoningEffort: getReasoningEffort('secretary'), verbosity: 'low' }
  );
  console.log(`   ✓ Secretary complete (${secretaryResult.tokens.total} tokens)\n`);
  
  // PHASE 2: Board members in parallel
  console.log('👥 PHASE 2: Board members reviewing in parallel...');
  const boardPersonas = [
    { id: 'operator', file: 'operator.txt' },
    { id: 'finance', file: 'finance.txt' },
    { id: 'craft-expert', file: 'craft-expert.txt' },
    { id: 'contrarian', file: 'contrarian.txt' }
  ];
  
  const boardPromises = boardPersonas.map(async ({ id, file }) => {
    const prompt = loadPrompt(file);
    const result = await llm.completeWithRetry(
      prompt,
      memoText,
      {
        jsonSchema: SCHEMAS.board_member,
        reasoningEffort: getReasoningEffort(id),
        verbosity: 'medium'
      }
    );
    console.log(`   ✓ ${id} complete (${result.tokens.total} tokens, ${result.tokens.reasoning} reasoning)`);
    return { persona: id, result };
  });
  
  const boardResults = await Promise.all(boardPromises);
  console.log('   ✓ All board members complete\n');
  
  // Save board responses
  for (const { persona, result } of boardResults) {
    saveResponse(sessionId, persona, result);
  }
  
  // PHASE 3: Supreme Strategist (high reasoning for synthesis)
  console.log('🎯 PHASE 3: Supreme Strategist synthesizing...');
  const strategistPrompt = loadPrompt('strategist.txt');
  const synthesisInput = formatSynthesisInput(memoData, boardResults);
  
  const strategistResult = await llm.completeWithRetry(
    strategistPrompt,
    synthesisInput,
    {
      jsonSchema: SCHEMAS.strategist,
      reasoningEffort: getReasoningEffort('strategist'),
      verbosity: 'medium',
      includeReasoning: true
    }
  );
  console.log(`   ✓ Strategist complete (${strategistResult.tokens.total} tokens)\n`);
  
  saveResponse(sessionId, 'strategist', strategistResult);
  
  db.prepare(`UPDATE sessions SET status = 'complete', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(sessionId);
  
  const totalTokens = secretaryResult.tokens.total + 
    boardResults.reduce((sum, r) => sum + r.result.tokens.total, 0) + 
    strategistResult.tokens.total;
  
  console.log(`${'='.repeat(60)}`);
  console.log(`✅ BOARD MEETING COMPLETE - Total tokens: ${totalTokens}`);
  console.log(`${'='.repeat(60)}\n`);
  
  return { sessionId, status: 'complete', secretary: secretaryResult, board: boardResults, strategist: strategistResult, totalTokens };
}

function saveResponse(sessionId, personaId, result) {
  const responseId = uuidv4();
  const parsed = result.parsed || {};
  
  db.prepare(`
    INSERT INTO responses (id, session_id, persona_id, position, top_reasons, top_risks, recommended_modifications, validation_metrics, confidence, raw_analysis, tokens_used)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    responseId, sessionId, personaId,
    parsed.position || parsed.integrated_recommendation?.decision || '',
    JSON.stringify(parsed.top_reasons || []),
    JSON.stringify(parsed.top_risks || []),
    JSON.stringify(parsed.recommended_modifications || []),
    JSON.stringify(parsed.validation_metrics || {}),
    parsed.confidence || 'medium',
    result.raw,
    result.tokens.total
  );
}

function formatMemoForPrompt(memo) {
  return `
## Board Memo

### Context
${memo.context.map(c => `- ${c}`).join('\n')}

### Decision Required
${memo.decision_required}

### Options
${memo.options.map((o, i) => `${i + 1}. ${o.description || o}`).join('\n')}

### Constraints
- Time: ${memo.constraints.time || 'Not specified'}
- Budget: ${memo.constraints.budget || 'Not specified'}
- Risk Tolerance: ${memo.constraints.risk_tolerance || 'Medium'}
${memo.constraints.politics ? `- Political considerations: ${memo.constraints.politics}` : ''}

### Success Metrics
${memo.success_metrics.map(m => `- ${m}`).join('\n')}

### Questions for the Board
${memo.questions_for_board.map((q, i) => `${i + 1}. ${q}`).join('\n')}
`.trim();
}

function formatSynthesisInput(memo, boardResults) {
  const boardSummary = boardResults.map(({ persona, result }) => {
    const p = result.parsed || {};
    return `
### ${persona.toUpperCase()}
- **Position:** ${p.position || 'N/A'}
- **Top Reasons:** ${(p.top_reasons || []).join('; ')}
- **Top Risks:** ${(p.top_risks || []).join('; ')}
- **Confidence:** ${p.confidence || 'N/A'}
`;
  }).join('\n');
  
  return `
## Original Memo
${formatMemoForPrompt(memo)}

---

## Board Member Responses
${boardSummary}

---

Please synthesize these perspectives into a single, coherent recommendation.
`.trim();
}
```

---

## Step 7: Persona Prompts

Create these files in `server/prompts/`:

### `server/prompts/secretary.txt`

```
You are the Board Secretary for a Personal Board of Directors system.

Your role is to:
1. Normalize and clean the Chair's memo
2. Extract key assumptions
3. Flag any missing critical information
4. Prepare a standardized briefing for the other board members

You are procedural, neutral, and crisp. You do not offer opinions or recommendations.

Respond in JSON format:
{
  "normalized_memo": {
    "context_summary": "string",
    "core_question": "string",
    "options_summary": ["string"],
    "key_constraints": ["string"]
  },
  "extracted_assumptions": ["string"],
  "missing_information": ["string"],
  "briefing_ready": boolean
}
```

### `server/prompts/operator.txt`

```
You are The Operator (COO) on a Personal Board of Directors.

Your job is to convert strategic decisions into executable plans. You focus on:
- Sequence of actions
- Dependencies
- "Next 7 days" concrete steps
- Risk controls and contingencies

You are direct, concrete, and timeline-focused. You avoid abstract strategy talk.

Respond in JSON format:
{
  "position": "Your clear stance on the decision",
  "top_reasons": ["reason1", "reason2", "reason3"],
  "top_risks": ["risk1", "risk2"],
  "recommended_modifications": ["modification1"],
  "execution_sequence": [
    {"step": 1, "action": "string", "duration": "string", "dependency": "string or null"}
  ],
  "next_7_days": ["concrete action 1", "concrete action 2"],
  "validation_metrics": {
    "30_day": ["metric"],
    "90_day": ["metric"]
  },
  "confidence": "low | medium | high"
}
```

### `server/prompts/finance.txt`

```
You are The Finance Brain (CFO) on a Personal Board of Directors.

Your job is to evaluate decisions through a financial lens:
- ROI and payback period
- Downside risk and worst-case scenarios
- Opportunity cost
- Liquidity impact
- Optionality (does this open or close future doors?)

You push for simple rules and clear thresholds. You are quantitative when possible.

Respond in JSON format:
{
  "position": "Your clear stance on the decision",
  "top_reasons": ["reason1", "reason2", "reason3"],
  "top_risks": ["risk1", "risk2"],
  "financial_analysis": {
    "estimated_roi": "string or null",
    "payback_period": "string or null",
    "downside_exposure": "string",
    "opportunity_cost": "string",
    "optionality_impact": "opens doors | closes doors | neutral"
  },
  "thresholds": {
    "proceed_if": "condition",
    "stop_if": "condition"
  },
  "recommended_modifications": ["modification1"],
  "validation_metrics": {
    "30_day": ["metric"],
    "90_day": ["metric"]
  },
  "confidence": "low | medium | high"
}
```

### `server/prompts/craft-expert.txt`

```
You are The Craft Expert (Domain Mentor) on a Personal Board of Directors.

Your job is to improve the quality of the approach within the Chair's domain. You focus on:
- Best practices and proven methods
- Common pitfalls in this domain
- Quality signals and red flags
- Sharper framing and narrative

You are domain-deep and craft-proud. You avoid generic advice.

Respond in JSON format:
{
  "position": "Your clear stance on the decision",
  "top_reasons": ["reason1", "reason2", "reason3"],
  "top_risks": ["risk1", "risk2"],
  "craft_assessment": {
    "approach_quality": "strong | adequate | weak",
    "best_practices_alignment": ["practice1", "practice2"],
    "common_pitfalls_present": ["pitfall1"],
    "recommended_method_changes": ["change1"]
  },
  "sharper_framing": "A better way to think about this decision",
  "recommended_modifications": ["modification1"],
  "validation_metrics": {
    "30_day": ["metric"],
    "90_day": ["metric"]
  },
  "confidence": "low | medium | high"
}
```

### `server/prompts/contrarian.txt`

```
You are The Contrarian (Red Team) on a Personal Board of Directors.

Your job is to assume the plan is wrong and find the holes. You focus on:
- Failure modes and how things could go wrong
- Hidden assumptions that might be false
- Second-order effects not being considered
- What the "anti-portfolio" looks like (reasons to NOT do this)

You are skeptical but constructive. You must provide a counter-proposal, not just criticism.

Respond in JSON format:
{
  "position": "Your clear stance (often skeptical)",
  "top_reasons": ["reason for skepticism 1", "reason 2", "reason 3"],
  "top_risks": ["risk1", "risk2"],
  "pre_mortem": {
    "most_likely_failure_mode": "string",
    "hidden_assumptions": ["assumption1", "assumption2"],
    "second_order_effects": ["effect1", "effect2"],
    "black_swan_scenario": "string"
  },
  "counter_proposal": {
    "alternative": "What to do instead",
    "rationale": "Why this might be better"
  },
  "recommended_modifications": ["modification1"],
  "validation_metrics": {
    "30_day": ["metric"],
    "90_day": ["metric"]
  },
  "confidence": "low | medium | high"
}
```

### `server/prompts/strategist.txt`

```
You are the Supreme Strategist on a Personal Board of Directors.

You are the mentor—calm, incisive, and not verbose. You use "If this is true, then..." logic. You call out illusions (vanity metrics, sunk cost, ego-protection).

Your job is to:
1. Synthesize all board member perspectives
2. Resolve disagreements with a clear decision
3. Provide execution guardrails
4. Identify the one assumption most worth testing

You receive the original memo and all board member responses. You must deliver ONE clear recommendation.

Respond in JSON format:
{
  "integrated_recommendation": {
    "decision": "Clear, unambiguous decision statement in one sentence",
    "rationale": "2-3 sentences on why this is the right call",
    "reversibility": "high | medium | low"
  },
  "agreement_areas": ["area where board agreed"],
  "disagreement_areas": ["area where board disagreed"],
  "resolution": "How you resolved the disagreement",
  "execution_guardrails": [
    "If you do this, do it this way: guardrail 1",
    "Watch out for: guardrail 2"
  ],
  "pre_mortem": {
    "failure_modes": ["mode1", "mode2"],
    "mitigations": ["mitigation1", "mitigation2"]
  },
  "next_actions": [
    {"action": "Specific next step", "owner": "Chair", "timeframe": "This week"},
    {"action": "Another step", "owner": "Chair", "timeframe": "Next 30 days"}
  ],
  "assumption_to_test": "The ONE assumption most worth validating before full commitment",
  "decision_statement": "A reusable one-paragraph decision statement for the log"
}
```

---

## Step 8: Frontend Files

### Create `frontend/index.html` (Dashboard)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Personal Board of Directors</title>
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <nav class="nav">
    <h1>🎯 Personal Board</h1>
    <div class="nav-links">
      <a href="index.html" class="active">Dashboard</a>
      <a href="new-memo.html">New Memo</a>
      <a href="decision-log.html">Decision Log</a>
      <a href="personas.html">Personas</a>
    </div>
  </nav>
  
  <main class="container">
    <section class="hero">
      <h2>Your Board Awaits</h2>
      <p>Submit a memo. Get structured advice. Make better decisions.</p>
      <a href="new-memo.html" class="btn btn-primary">+ New Board Memo</a>
    </section>
    
    <section class="recent">
      <h3>Recent Sessions</h3>
      <div id="recent-sessions" class="sessions-list">
        <p class="loading">Loading...</p>
      </div>
    </section>
    
    <section class="actions">
      <h3>Open Actions</h3>
      <div id="open-actions" class="actions-list">
        <p class="loading">Loading...</p>
      </div>
    </section>
  </main>
  
  <script src="js/api.js"></script>
  <script>
    async function loadDashboard() {
      // Load recent sessions
      const sessions = await api.getSessions({ limit: 5 });
      const sessionsEl = document.getElementById('recent-sessions');
      
      if (sessions.length === 0) {
        sessionsEl.innerHTML = '<p class="empty">No sessions yet. Create your first board memo!</p>';
      } else {
        sessionsEl.innerHTML = sessions.map(s => `
          <a href="session-view.html?id=${s.id}" class="session-card">
            <span class="status status-${s.status}">${s.status}</span>
            <span class="category">${s.category || 'General'}</span>
            <span class="date">${new Date(s.created_at).toLocaleDateString()}</span>
          </a>
        `).join('');
      }
    }
    
    loadDashboard();
  </script>
</body>
</html>
```

### Create `frontend/js/api.js`

```javascript
const API_BASE = 'http://localhost:3000/api';

const api = {
  async getSessions(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/sessions?${query}`);
    return res.json();
  },
  
  async getSession(id) {
    const res = await fetch(`${API_BASE}/sessions/${id}`);
    return res.json();
  },
  
  async createSession(category) {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category })
    });
    return res.json();
  },
  
  async saveMemo(sessionId, memo) {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/memo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(memo)
    });
    return res.json();
  },
  
  async runBoardMeeting(sessionId) {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/run`, {
      method: 'POST'
    });
    return res.json();
  },
  
  async getDecisions(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/decisions?${query}`);
    return res.json();
  },
  
  async finalizeDecision(sessionId, decision) {
    const res = await fetch(`${API_BASE}/sessions/${sessionId}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(decision)
    });
    return res.json();
  }
};
```

### Create `frontend/css/styles.css`

```css
:root {
  --bg: #0f0f0f;
  --surface: #1a1a1a;
  --border: #2a2a2a;
  --text: #e0e0e0;
  --text-muted: #888;
  --primary: #3b82f6;
  --success: #22c55e;
  --warning: #f59e0b;
  --error: #ef4444;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
}

.nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.nav h1 {
  font-size: 1.25rem;
}

.nav-links a {
  color: var(--text-muted);
  text-decoration: none;
  margin-left: 1.5rem;
}

.nav-links a.active,
.nav-links a:hover {
  color: var(--text);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.hero {
  text-align: center;
  padding: 3rem 0;
}

.hero h2 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.hero p {
  color: var(--text-muted);
  margin-bottom: 1.5rem;
}

.btn {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 500;
  cursor: pointer;
  border: none;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover {
  opacity: 0.9;
}

section h3 {
  margin-bottom: 1rem;
  font-size: 1.1rem;
}

.sessions-list,
.actions-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.session-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  text-decoration: none;
  color: var(--text);
}

.session-card:hover {
  border-color: var(--primary);
}

.status {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  text-transform: uppercase;
}

.status-draft { background: var(--border); }
.status-running { background: var(--warning); color: black; }
.status-complete { background: var(--success); color: black; }

.loading,
.empty {
  color: var(--text-muted);
  font-style: italic;
}

/* Forms */
.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 0.75rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  font-size: 1rem;
}

.form-group textarea {
  min-height: 100px;
  resize: vertical;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--primary);
}

.form-hint {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-top: 0.25rem;
}
```

---

## Running the Application

### 1. Start the server

```bash
npm run dev
```

You should see:
```
🎯 Personal Board server running at http://localhost:3000
📂 Open frontend/index.html in your browser to start
```

### 2. Open the frontend

Simply open `frontend/index.html` in your browser:

```bash
# macOS
open frontend/index.html

# Linux
xdg-open frontend/index.html

# Windows
start frontend/index.html
```

Or drag the file into your browser.

### 3. Create your first board memo

1. Click "New Board Memo"
2. Fill in the form
3. Click "Convene Board"
4. Wait for all personas to respond
5. Review the Strategist's synthesis
6. Finalize your decision

---

## Troubleshooting

### "Connection refused" errors

Make sure the server is running on port 3000:
```bash
npm run dev
```

### CORS errors

Check that the server is running and `cors_origin` in config.json is set to `"*"` for local development.

### LLM API errors

1. Verify your API key in `config/config.json`
2. Check you have credits/quota with your provider
3. Look at server console for detailed error messages

### Database errors

Reset the database:
```bash
npm run db:reset
```

---

## Next Steps

Once the MVP is working:

1. **Add more HTML pages**: `new-memo.html`, `session-view.html`, `decision-log.html`
2. **Implement action tracking**: Add ability to mark actions complete
3. **Add retrospectives**: Update decisions with outcomes
4. **Persona tuning**: UI to edit persona prompts
5. **Export**: Generate PDF/Markdown summaries of decisions

---

## Security Notes

- **Never commit** `config/config.json` (add to `.gitignore`)
- **API keys stay server-side** — frontend only talks to your local server
- For hosted deployment, use environment variables instead of config files
- Consider adding basic auth if exposing beyond localhost
