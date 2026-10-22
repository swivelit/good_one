
const express = require('express');
const router = express.Router();

const {
  createCoupon,
  listCoupons,
  listAvailableCoupons,
  deactivateCoupon,
  validateCoupon,
} = require('../Controllers/couponController');

const { protect, adminOnly, customerOnly } = require('../middleware/auth');

// Admin routes
router.post('/', protect, adminOnly, createCoupon);
router.get('/', protect, adminOnly, listCoupons);
router.get('/available', protect, customerOnly, listAvailableCoupons);
router.patch('/:id/deactivate', protect, adminOnly, deactivateCoupon);

// Customer route
router.post('/validate', protect, customerOnly, validateCoupon);

module.exports = router;
