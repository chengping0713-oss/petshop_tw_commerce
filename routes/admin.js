// routes/admin.js - 後台儀表板統計
const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminMiddleware } = require('../middleware/auth');

router.get('/dashboard', adminMiddleware, (req, res) => {
  const month_revenue = db.prepare(`SELECT COALESCE(SUM(total), 0) as revenue FROM orders WHERE status != 'cancelled' AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`).get().revenue;
  const total_orders = db.prepare(`SELECT COUNT(*) as count FROM orders`).get().count;
  const new_members = db.prepare(`SELECT COUNT(*) as count FROM members WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now') AND role = 'user'`).get().count;
  const pending_orders = db.prepare(`SELECT COUNT(*) as count FROM orders WHERE status = 'pending'`).get().count;
  const low_stock = db.prepare(`SELECT * FROM products WHERE stock <= 10 AND status = 'active' ORDER BY stock ASC LIMIT 5`).all();
  const recent_orders = db.prepare(`SELECT o.*, m.name as member_name FROM orders o LEFT JOIN members m ON o.member_id = m.id ORDER BY o.created_at DESC LIMIT 8`).all();

  res.json({
    success: true,
    data: {
      stats: { month_revenue, total_orders, new_members, pending_orders },
      low_stock,
      recent_orders
    }
  });
});

module.exports = router;
