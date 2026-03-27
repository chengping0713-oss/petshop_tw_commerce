// routes/products.js - 商品 API
const express = require('express');
const router = express.Router();
const db = require('../db');
const { adminMiddleware } = require('../middleware/auth');

// 取得所有商品（支援篩選）
router.get('/', (req, res) => {
  const { category, pet_type, brand, search, sort = 'id', order = 'ASC', page = 1, limit = 12 } = req.query;
  let sql = `SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.status = 'active'`;
  const params = [];

  if (category) { sql += ' AND c.slug = ?'; params.push(category); }
  if (pet_type && pet_type !== 'all') { sql += ' AND (p.pet_type = ? OR p.pet_type = "both")'; params.push(pet_type); }
  if (brand) { sql += ' AND p.brand = ?'; params.push(brand); }
  if (search) { sql += ' AND (p.name LIKE ? OR p.brand LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

  const validSort = ['id', 'price', 'name', 'stock', 'created_at'];
  const sortCol = validSort.includes(sort) ? sort : 'id';
  sql += ` ORDER BY p.${sortCol} ${order === 'DESC' ? 'DESC' : 'ASC'}`;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const total = db.prepare(sql.replace('SELECT p.*, c.name as category_name', 'SELECT COUNT(*)')).get(...params);
  sql += ` LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), offset);

  const products = db.prepare(sql).all(...params);
  res.json({ success: true, data: products, total: total['COUNT(*)'], page: parseInt(page), limit: parseInt(limit) });
});

// 取得單一商品
router.get('/:id', (req, res) => {
  const product = db.prepare(`SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?`).get(req.params.id);
  if (!product) return res.status(404).json({ success: false, message: '找不到此商品' });
  res.json({ success: true, data: product });
});

// 新增商品（管理員）
router.post('/', adminMiddleware, (req, res) => {
  const { name, brand, category_id, description, ingredients, price, original_price, stock, image, status, pet_type } = req.body;
  if (!name || !brand || !price) return res.status(400).json({ success: false, message: '請填寫必填欄位' });

  const result = db.prepare(`INSERT INTO products (name, brand, category_id, description, ingredients, price, original_price, stock, image, status, pet_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(name, brand, category_id, description, ingredients, price, original_price || price, stock || 0, image, status || 'active', pet_type || 'both');
  res.json({ success: true, message: '商品新增成功', id: result.lastInsertRowid });
});

// 更新商品（管理員）
router.put('/:id', adminMiddleware, (req, res) => {
  const { name, brand, category_id, description, ingredients, price, original_price, stock, image, status, pet_type } = req.body;
  db.prepare(`UPDATE products SET name=?, brand=?, category_id=?, description=?, ingredients=?, price=?, original_price=?, stock=?, image=?, status=?, pet_type=? WHERE id=?`)
    .run(name, brand, category_id, description, ingredients, price, original_price, stock, image, status, pet_type, req.params.id);
  res.json({ success: true, message: '商品更新成功' });
});

// 刪除商品（管理員）
router.delete('/:id', adminMiddleware, (req, res) => {
  db.prepare("UPDATE products SET status = 'deleted' WHERE id = ?").run(req.params.id);
  res.json({ success: true, message: '商品已刪除' });
});

module.exports = router;
