const express = require('express');
const { getPublicStats } = require('../Controllers/statsController');

const router = express.Router();

router.get('/public', getPublicStats);

module.exports = router;
