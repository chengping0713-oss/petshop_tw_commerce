// routes/orders.js - 訂單 API
const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// 產生訂單編號
function genOrderNo() {
  const now = new Date();
  const date = now.toISOString().slice(0,10).replace(/-/g,'');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `ORD-${date}-${rand}`;
}

// 建立訂單
router.post('/', authMiddleware, (req, res) => {
  const { items, name, phone, address, coupon_code, payment_method, note } = req.body;
  if (!items || !items.length) return res.status(400).json({ success: false, message: '購物車是空的' });
  if (!name || !phone || !address) return res.status(400).json({ success: false, message: '請填寫收件資料' });

  // 計算金額
  let subtotal = 0;
  const orderItems = [];
  for (const item of items) {
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND status = "active"').get(item.product_id);
    if (!product) return res.status(400).json({ success: false, message: `找不到商品 ID: ${item.product_id}` });
    if (product.stock < item.quantity) return res.status(400).json({ success: false, message: `${product.name} 庫存不足` });
    subtotal += product.price * item.quantity;
    orderItems.push({ ...item, price: product.price, name: product.name, product });
  }

  // 計算運費
  const shipping_fee = subtotal >= 1200 ? 0 : 100;

  // 驗證優惠券
  let discount = 0;
  if (coupon_code) {
    const coupon = db.prepare(`SELECT * FROM coupons WHERE code = ? AND is_active = 1 AND (end_date IS NULL OR end_date >= date('now'))`).get(coupon_code);
    if (!coupon) return res.status(400).json({ success: false, message: '優惠券無效或已過期' });
    if (subtotal < coupon.min_amount) return res.status(400).json({ success: false, message: `最低消費 NT$ ${coupon.min_amount} 才可使用此優惠券` });
    if (coupon.max_uses > 0 && coupon.used_count >= coupon.max_uses) return res.status(400).json({ success: false, message: '優惠券已達使用上限' });

    if (coupon.type === 'percent') discount = Math.floor(subtotal * coupon.value / 100);
    else if (coupon.type === 'fixed') discount = coupon.value;
    else if (coupon.type === 'freeship') discount = shipping_fee;
  }

  const total = subtotal + shipping_fee - discount;
  const order_no = genOrderNo();

  // 建立訂單（交易）
  const createOrder = db.transaction(() => {
    const order = db.prepare(`INSERT INTO orders (order_no, member_id, total, shipping_fee, discount, status, payment_method, name, phone, address, coupon_code, note) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`)
      .run(order_no, req.user.id, total, shipping_fee, discount, payment_method || 'credit_card', name, phone, address, coupon_code || null, note || null);

    for (const item of orderItems) {
      db.prepare('INSERT INTO order_items (order_id, product_id, product_name, price, quantity) VALUES (?, ?, ?, ?, ?)')
        .run(order.lastInsertRowid, item.product_id, item.name, item.price, item.quantity);
      db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(item.quantity, item.product_id);
    }

    if (coupon_code) db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE code = ?').run(coupon_code);
    return order.lastInsertRowid;
  });

  const order_id = createOrder();
  res.json({ success: true, message: '訂單建立成功！', order_no, order_id, total });
});

// 取得會員訂單
router.get('/my', authMiddleware, (req, res) => {
  const orders = db.prepare(`SELECT o.*, GROUP_CONCAT(oi.product_name || ' x' || oi.quantity, ', ') as items_summary FROM orders o LEFT JOIN order_items oi ON o.id = oi.order_id WHERE o.member_id = ? GROUP BY o.id ORDER BY o.created_at DESC`).all(req.user.id);
  res.json({ success: true, data: orders });
});

// 取得單一訂單
router.get('/:order_no', authMiddleware, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE order_no = ? AND member_id = ?').get(req.params.order_no, req.user.id);
  if (!order) return res.status(404).json({ success: false, message: '找不到此訂單' });
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  res.json({ success: true, data: { ...order, items } });
});

// ===== 管理員 API =====
router.get('/', adminMiddleware, (req, res) => {
  const { status, page = 1, limit = 20, search } = req.query;
  let sql = `SELECT o.*, m.name as member_name, m.email as member_email FROM orders o LEFT JOIN members m ON o.member_id = m.id WHERE 1=1`;
  const params = [];
  if (status) { sql += ' AND o.status = ?'; params.push(status); }
  if (search) { sql += ' AND (o.order_no LIKE ? OR o.name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  sql += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page)-1)*parseInt(limit));
  const orders = db.prepare(sql).all(...params);
  res.json({ success: true, data: orders });
});

router.put('/:id/status', adminMiddleware, (req, res) => {
  const { status, payment_status } = req.body;
  db.prepare('UPDATE orders SET status = ?, payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(status, payment_status, req.params.id);
  res.json({ success: true, message: '訂單狀態已更新' });
});

module.exports = router;
