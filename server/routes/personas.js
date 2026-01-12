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
