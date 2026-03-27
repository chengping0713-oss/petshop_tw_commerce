const jwt = require('jsonwebtoken');
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: '請先登入' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ success: false, message: 'Token 已過期，請重新登入' }); }
}
function adminMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: '請先登入' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ success: false, message: '無管理員權限' });
    req.user = decoded; next();
  } catch { return res.status(401).json({ success: false, message: 'Token 已過期' }); }
}
module.exports = { authMiddleware, adminMiddleware };
