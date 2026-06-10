const express = require('express');
const router = express.Router();

const {
getVendors,
getVendor,
getMyProfile,
updateProfile,
getAllVendorsAdmin
} = require('../Controllers/vendorController');

const {protect, adminOnly} = require('../middleware/auth');

router.get('/',getVendors);

router.get('/me',protect,getMyProfile);

router.put('/profile',protect,updateProfile);

router.get('/admin/all',protect,adminOnly,getAllVendorsAdmin);

router.get('/:id',getVendor);

module.exports = router;
