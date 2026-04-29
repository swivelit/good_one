const express = require('express');
const router = express.Router();
const { blockUser } = require('../Controllers/blockController');
const { protect } = require('../middleware/auth');

router.post('/', protect, blockUser);

module.exports = router;
