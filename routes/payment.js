// routes/payment.js - 綠界 ECPay 金流串接
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// ===== 綠界設定 =====
// 測試環境：https://payment-stage.ecpay.com.tw
// 正式環境：https://payment.ecpay.com.tw
const ECPAY_CONFIG = {
  MerchantID: process.env.ECPAY_MERCHANT_ID || '2000132',       // 測試商店代號
  HashKey: process.env.ECPAY_HASH_KEY || '5294y06JbISpM5x9',   // 測試 HashKey
  HashIV: process.env.ECPAY_HASH_IV || 'v77hoKGq4kWxNNIS',     // 測試 HashIV
  PaymentURL: process.env.NODE_ENV === 'production'
    ? 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5'
    : 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
  ReturnURL: process.env.ECPAY_RETURN_URL || 'http://localhost:3000/api/payment/notify',
  OrderResultURL: process.env.ECPAY_RESULT_URL || 'http://localhost:3000/api/payment/result',
};

// ===== 產生 CheckMacValue =====
function generateCheckMac(params, hashKey, hashIV) {
  // 1. 按參數名稱字母排序
  const sorted = Object.keys(params).sort().reduce((acc, key) => {
    acc[key] = params[key];
    return acc;
  }, {});

  // 2. 組合字串
  let raw = `HashKey=${hashKey}`;
  for (const [k, v] of Object.entries(sorted)) {
    raw += `&${k}=${v}`;
  }
  raw += `&HashIV=${hashIV}`;

  // 3. URL encode（綠界特殊規則）
  raw = encodeURIComponent(raw)
    .replace(/%2d/gi, '-')
    .replace(/%5f/gi, '_')
    .replace(/%2e/gi, '.')
    .replace(/%21/gi, '!')
    .replace(/%2a/gi, '*')
    .replace(/%28/gi, '(')
    .replace(/%29/gi, ')')
    .toLowerCase();

  // 4. SHA256 加密後轉大寫
  return crypto.createHash('sha256').update(raw).digest('hex').toUpperCase();
}

// ===== 建立付款表單 =====
router.post('/create', authMiddleware, (req, res) => {
  const { order_id } = req.body;

  // 查詢訂單
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND member_id = ?').get(order_id, req.user.id);
  if (!order) return res.status(404).json({ success: false, message: '找不到訂單' });
  if (order.payment_status === 'paid') return res.status(400).json({ success: false, message: '此訂單已付款' });

  // 取得訂單商品
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  const itemNames = items.map(i => i.product_name).join('#');

  // 產生綠界日期格式：yyyy/MM/dd HH:mm:ss
  const now = new Date();
  const tradeDate = now.toLocaleString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Taipei'
  }).replace(/\//g, '/').replace(/,/g, '');

  // 綠界付款參數
  const params = {
    MerchantID: ECPAY_CONFIG.MerchantID,
    MerchantTradeNo: order.order_no.replace(/-/g, '').slice(-20), // 最多20碼
    MerchantTradeDate: tradeDate,
    PaymentType: 'aio',
    TotalAmount: order.total.toString(),
    TradeDesc: encodeURIComponent('PawPick 毛選 寵物商品'),
    ItemName: itemNames.slice(0, 200), // 最多200字
    ReturnURL: ECPAY_CONFIG.ReturnURL,
    OrderResultURL: ECPAY_CONFIG.OrderResultURL,
    ChoosePayment: 'ALL', // 全部付款方式
    EncryptType: '1',     // SHA256
    ClientBackURL: `${process.env.FRONTEND_URL || 'http://localhost:5500'}/index.html`,
  };

  // 產生 CheckMacValue
  params.CheckMacValue = generateCheckMac(params, ECPAY_CONFIG.HashKey, ECPAY_CONFIG.HashIV);

  // 更新訂單的綠界交易編號
  db.prepare('UPDATE orders SET payment_status = ? WHERE id = ?').run('pending_payment', order.id);

  res.json({
    success: true,
    payment_url: ECPAY_CONFIG.PaymentURL,
    params
  });
});

// ===== 綠界付款通知（伺服器端）=====
router.post('/notify', express.urlencoded({ extended: true }), (req, res) => {
  const data = req.body;

  // 驗證 CheckMacValue
  const { CheckMacValue, ...params } = data;
  const computed = generateCheckMac(params, ECPAY_CONFIG.HashKey, ECPAY_CONFIG.HashIV);

  if (computed !== CheckMacValue) {
    console.error('❌ ECPay CheckMacValue 驗證失敗');
    return res.send('0|ErrorCode');
  }

  // 付款成功
  if (data.RtnCode === '1') {
    // 根據 MerchantTradeNo 找訂單
    const tradeNo = data.MerchantTradeNo;
    const order = db.prepare("SELECT * FROM orders WHERE REPLACE(REPLACE(order_no,'-',''),'ORD','') LIKE ?").get(`%${tradeNo.slice(-8)}%`);

    if (order) {
      db.prepare("UPDATE orders SET payment_status='paid', status='paid', updated_at=CURRENT_TIMESTAMP WHERE id=?").run(order.id);
      console.log(`✅ 訂單 ${order.order_no} 付款成功`);
    }
  }

  res.send('1|OK'); // 必須回傳 1|OK 給綠界
});

// ===== 付款完成導回（前端）=====
router.get('/result', (req, res) => {
  const { RtnCode, MerchantTradeNo } = req.query;
  const success = RtnCode === '1';
  // 導回前台訂單頁
  res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5500'}/index.html?payment=${success?'success':'fail'}&trade=${MerchantTradeNo}`);
});

// ===== 查詢付款狀態 =====
router.get('/status/:order_id', authMiddleware, (req, res) => {
  const order = db.prepare('SELECT order_no, payment_status, status FROM orders WHERE id = ? AND member_id = ?').get(req.params.order_id, req.user.id);
  if (!order) return res.status(404).json({ success: false, message: '找不到訂單' });
  res.json({ success: true, data: order });
});

module.exports = router;
