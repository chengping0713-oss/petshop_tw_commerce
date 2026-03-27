// routes/upload.js - 圖片上傳
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { adminMiddleware } = require('../middleware/auth');

const uploadDir = process.env.UPLOAD_PATH || './uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('只允許上傳圖片檔案'));
  }
});

router.post('/image', adminMiddleware, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: '請選擇圖片' });
  res.json({ success: true, url: `/uploads/${req.file.filename}`, filename: req.file.filename });
});

module.exports = router;
