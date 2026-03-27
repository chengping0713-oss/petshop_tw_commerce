// routes/members.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminMiddleware } = require('../middleware/auth');

router.get('/', adminMiddleware, (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  let sql = 'SELECT id, name, email, phone, points, role, created_at FROM members WHERE role != "admin"';
  const params = [];
  if (search) { sql += ' AND (name LIKE ? OR email LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page)-1)*parseInt(limit));
  const members = db.prepare(sql).all(...params);
  res.json({ success: true, data: members });
});

router.delete('/:id', adminMiddleware, (req, res) => {
  db.prepare('DELETE FROM members WHERE id = ? AND role != "admin"').run(req.params.id);
  res.json({ success: true, message: '會員已刪除' });
});

module.exports = router;
