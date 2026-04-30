const express = require('express');
const router = express.Router();

const {
getVendors,
getVendor,
getMyProfile,
updateProfile
} = require('../Controllers/vendorController');

const {protect} = require('../middleware/auth');

router.get('/',getVendors);

router.get('/me',protect,getMyProfile);

router.put('/profile',protect,updateProfile);

router.get('/:id',getVendor);

module.exports = router;
