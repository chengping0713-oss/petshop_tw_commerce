// routes/announcements.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminMiddleware } = require('../middleware/auth');

router.get('/', (req, res) => {
  const items = db.prepare(`SELECT * FROM announcements WHERE is_active = 1 AND (end_date IS NULL OR end_date >= date('now')) ORDER BY created_at DESC`).all();
  res.json({ success: true, data: items });
});
router.post('/', adminMiddleware, (req, res) => {
  const { content, position, start_date, end_date } = req.body;
  const r = db.prepare('INSERT INTO announcements (content, position, start_date, end_date) VALUES (?, ?, ?, ?)').run(content, position||'topbar', start_date||null, end_date||null);
  res.json({ success: true, message: '公告已發布', id: r.lastInsertRowid });
});
router.put('/:id', adminMiddleware, (req, res) => {
  const { is_active, content } = req.body;
  db.prepare('UPDATE announcements SET is_active = ?, content = ? WHERE id = ?').run(is_active, content, req.params.id);
  res.json({ success: true });
});
router.delete('/:id', adminMiddleware, (req, res) => {
  db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});
module.exports = router;
