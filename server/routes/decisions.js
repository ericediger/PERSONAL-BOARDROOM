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
