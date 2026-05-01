const jwt = require('jsonwebtoken');
const prisma = require('../Db/prisma');
const { sanitizeUser } = require('../utils/serialize');

const getBearerToken = (req) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    return req.headers.authorization.split(' ')[1];
  }
  return null;
};

exports.protect = async (req, res, next) => {
  const token = getBearerToken(req);
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

exports.optionalAuth = async (req, res, next) => {
  const token = getBearerToken(req);
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (user) req.user = sanitizeUser(user);
  } catch (error) {
    req.user = undefined;
  }

  return next();
};

exports.vendorOnly = (req, res, next) => {
  if (req.user && req.user.role === 'vendor') return next();
  return res.status(403).json({ success: false, message: 'Access denied. Vendors only.' });
};

exports.customerOnly = (req, res, next) => {
  if (req.user && req.user.role === 'customer') return next();
  return res.status(403).json({ success: false, message: 'Access denied. Customers only.' });
};
