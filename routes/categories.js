// routes/categories.js
const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
  const cats = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  res.json({ success: true, data: cats });
});
module.exports = router;
