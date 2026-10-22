
const express = require('express');
const router = express.Router();

const { createOrder, listMyOrders,cancelMyOrder, } = require('../Controllers/orderController');
const { protect, customerOnly } = require('../middleware/auth');

router.post('/', protect, customerOnly, createOrder);
router.get('/my', protect, customerOnly, listMyOrders);
router.patch('/:id/cancel', protect, customerOnly, cancelMyOrder);

module.exports = router;
