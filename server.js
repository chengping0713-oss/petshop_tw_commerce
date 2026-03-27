// server.js - PawPick 主程式（含綠界金流）
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// 建立必要資料夾
['./uploads', './database'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// CORS
app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'null'
    ].filter(Boolean);
    if (!origin || allowed.includes(origin)) callback(null, true);
    else callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===== 路由 =====
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/products',      require('./routes/products'));
app.use('/api/categories',    require('./routes/categories'));
app.use('/api/orders',        require('./routes/orders'));
app.use('/api/members',       require('./routes/members'));
app.use('/api/coupons',       require('./routes/coupons'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/cart',          require('./routes/cart'));
app.use('/api/admin',         require('./routes/admin'));
app.use('/api/upload',        require('./routes/upload'));
app.use('/api/payment',       require('./routes/payment')); // 綠界金流

// 健康檢查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: '🐾 PawPick API 運作正常',
    version: '1.0.0',
    time: new Date().toISOString()
  });
});

// 404
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: 'API 路徑不存在' });
});

// 錯誤處理
app.use((err, req, res, next) => {
  console.error('❌', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? '伺服器錯誤' : err.message
  });
});

app.listen(PORT, () => {
  console.log('');
  console.log('🐾 ================================');
  console.log(`   PawPick API 啟動成功！`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   健康檢查: /api/health`);
  console.log('🐾 ================================');
  console.log('');
});
