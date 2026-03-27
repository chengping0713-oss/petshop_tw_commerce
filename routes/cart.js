// routes/cart.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, (req, res) => {
  const items = db.prepare(`SELECT c.id, c.quantity, p.id as product_id, p.name, p.brand, p.price, p.original_price, p.image, p.stock FROM cart c JOIN products p ON c.product_id = p.id WHERE c.member_id = ?`).all(req.user.id);
  res.json({ success: true, data: items });
});

router.post('/', authMiddleware, (req, res) => {
  const { product_id, quantity = 1 } = req.body;
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND status = "active"').get(product_id);
  if (!product) return res.status(404).json({ success: false, message: '找不到商品' });
  db.prepare('INSERT INTO cart (member_id, product_id, quantity) VALUES (?, ?, ?) ON CONFLICT(member_id, product_id) DO UPDATE SET quantity = quantity + ?').run(req.user.id, product_id, quantity, quantity);
  res.json({ success: true, message: '已加入購物車' });
});

router.put('/:id', authMiddleware, (req, res) => {
  const { quantity } = req.body;
  if (quantity <= 0) { db.prepare('DELETE FROM cart WHERE id = ? AND member_id = ?').run(req.params.id, req.user.id); }
  else { db.prepare('UPDATE cart SET quantity = ? WHERE id = ? AND member_id = ?').run(quantity, req.params.id, req.user.id); }
  res.json({ success: true });
});

router.delete('/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM cart WHERE id = ? AND member_id = ?').run(req.params.id, req.user.id);
  res.json({ success: true });
});

router.delete('/', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM cart WHERE member_id = ?').run(req.user.id);
  res.json({ success: true, message: '購物車已清空' });
});

module.exports = router;
