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

// Load non-sensitive config for personas settings
let personasConfig = {};
try {
  const config = JSON.parse(readFileSync(join(__dirname, '../../config/config.json'), 'utf-8'));
  personasConfig = config.personas || {};
} catch (error) {
  console.warn('Warning: Could not load config.json for personas settings');
}

const llm = new LLMClient();

function loadPrompt(filename) {
  return readFileSync(join(__dirname, '../prompts', filename), 'utf-8');
}

// JSON schemas for structured outputs (enforced by GPT-5.2)
// Note: OpenAI strict mode requires ALL properties to be in the 'required' array
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
      required: ['position', 'top_reasons', 'top_risks', 'recommended_modifications', 'validation_metrics', 'confidence'],
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
      required: ['integrated_recommendation', 'agreement_areas', 'disagreement_areas', 'execution_guardrails', 'next_actions', 'assumption_to_test', 'decision_statement'],
      additionalProperties: false
    }
  }
};

export async function runBoardMeeting(sessionId) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`BOARD MEETING STARTED - Session: ${sessionId}`);
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
  console.log('PHASE 1: Secretary processing memo...');
  const secretaryPrompt = loadPrompt('secretary.txt');
  const secretaryResult = await llm.completeWithRetry(
    secretaryPrompt,
    memoText,
    { personaId: 'secretary', verbosity: 'low' }
  );
  console.log(`   Secretary complete (${secretaryResult.tokens.total} tokens)\n`);

  // PHASE 2: Board members in parallel
  console.log('PHASE 2: Board members reviewing in parallel...');
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
        personaId: id,
        verbosity: 'medium'
      }
    );
    console.log(`   ${id} complete (${result.tokens.total} tokens, ${result.tokens.reasoning} reasoning)`);
    return { persona: id, result };
  });

  const boardResults = await Promise.all(boardPromises);
  console.log('   All board members complete\n');

  // Save board responses
  for (const { persona, result } of boardResults) {
    saveResponse(sessionId, persona, result);
  }

  // PHASE 3: Supreme Strategist (high reasoning for synthesis)
  console.log('PHASE 3: Supreme Strategist synthesizing...');
  const strategistPrompt = loadPrompt('strategist.txt');
  const synthesisInput = formatSynthesisInput(memoData, boardResults);

  const strategistResult = await llm.completeWithRetry(
    strategistPrompt,
    synthesisInput,
    {
      jsonSchema: SCHEMAS.strategist,
      personaId: 'strategist',
      verbosity: 'medium',
      includeReasoning: true
    }
  );
  console.log(`   Strategist complete (${strategistResult.tokens.total} tokens)\n`);

  saveResponse(sessionId, 'strategist', strategistResult);

  db.prepare(`UPDATE sessions SET status = 'complete', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(sessionId);

  const totalTokens = secretaryResult.tokens.total +
    boardResults.reduce((sum, r) => sum + r.result.tokens.total, 0) +
    strategistResult.tokens.total;

  console.log(`${'='.repeat(60)}`);
  console.log(`BOARD MEETING COMPLETE - Total tokens: ${totalTokens}`);
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
