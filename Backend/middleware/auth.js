const jwt = require('jsonwebtoken');
const prisma = require('../Db/prisma');
const { sanitizeUser } = require('../utils/serialize');

exports.protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    req.user = sanitizeUser(user);
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

exports.vendorOnly = (req, res, next) => {
  if (req.user && req.user.role === 'vendor') return next();
  return res.status(403).json({ success: false, message: 'Access denied. Vendors only.' });
};

exports.customerOnly = (req, res, next) => {
  if (req.user && req.user.role === 'customer') return next();
  return res.status(403).json({ success: false, message: 'Access denied. Customers only.' });
};
