// routes/coupons.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// 驗證優惠券（前台）
router.post('/validate', authMiddleware, (req, res) => {
  const { code, amount } = req.body;
  const coupon = db.prepare(`SELECT * FROM coupons WHERE code = ? AND is_active = 1 AND (end_date IS NULL OR end_date >= date('now'))`).get(code);
  if (!coupon) return res.status(400).json({ success: false, message: '優惠券無效或已過期' });
  if (amount < coupon.min_amount) return res.status(400).json({ success: false, message: `最低消費 NT$ ${coupon.min_amount}` });
  if (coupon.max_uses > 0 && coupon.used_count >= coupon.max_uses) return res.status(400).json({ success: false, message: '優惠券已達使用上限' });
  res.json({ success: true, data: coupon });
});

// 管理員 CRUD
router.get('/', adminMiddleware, (req, res) => {
  res.json({ success: true, data: db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all() });
});

router.post('/', adminMiddleware, (req, res) => {
  const { code, type, value, min_amount, max_uses, end_date } = req.body;
  const result = db.prepare('INSERT INTO coupons (code, type, value, min_amount, max_uses, end_date) VALUES (?, ?, ?, ?, ?, ?)').run(code, type, value, min_amount||0, max_uses||0, end_date||null);
  res.json({ success: true, message: '優惠券已建立', id: result.lastInsertRowid });
});

router.put('/:id', adminMiddleware, (req, res) => {
  const { is_active } = req.body;
  db.prepare('UPDATE coupons SET is_active = ? WHERE id = ?').run(is_active, req.params.id);
  res.json({ success: true, message: '已更新' });
});

router.delete('/:id', adminMiddleware, (req, res) => {
  db.prepare('DELETE FROM coupons WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: '已刪除' });
});

module.exports = router;
