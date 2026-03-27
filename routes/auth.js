// routes/auth.js - 會員登入 / 註冊
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

// 註冊
router.post('/register', (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) return res.status(400).json({ success: false, message: '請填寫所有必填欄位' });
  if (password.length < 8) return res.status(400).json({ success: false, message: '密碼至少需要 8 個字元' });

  const existing = db.prepare('SELECT id FROM members WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ success: false, message: '此信箱已被註冊' });

  const hashed = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO members (name, email, password, phone) VALUES (?, ?, ?, ?)').run(name, email, hashed, phone || null);

  const token = jwt.sign({ id: result.lastInsertRowid, name, email, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ success: true, message: '註冊成功！', token, user: { id: result.lastInsertRowid, name, email, role: 'user' } });
});

// 登入
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, message: '請填寫信箱和密碼' });

  const user = db.prepare('SELECT * FROM members WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ success: false, message: '信箱或密碼錯誤' });

  const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ success: true, message: '登入成功！', token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// 取得個人資料
const { authMiddleware } = require('../middleware/auth');
router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, name, email, phone, address, points, role, created_at FROM members WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: '找不到會員' });
  res.json({ success: true, data: user });
});

// 更新個人資料
router.put('/me', authMiddleware, (req, res) => {
  const { name, phone, address } = req.body;
  db.prepare('UPDATE members SET name = ?, phone = ?, address = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(name, phone, address, req.user.id);
  res.json({ success: true, message: '資料更新成功' });
});

module.exports = router;
