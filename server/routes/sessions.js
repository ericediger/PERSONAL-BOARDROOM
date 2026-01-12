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
