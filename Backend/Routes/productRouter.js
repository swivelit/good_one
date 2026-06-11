const express = require('express');
const router = express.Router();
const {
  getProducts, getProductLocations, getProduct, createProduct, updateProduct,
  renewProduct, deleteProduct, getMyProducts, getVendorProducts,
} = require('../Controllers/productController');
const { protect, optionalAuth, vendorOnly } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const { uploadsDir } = require('../config/uploads');

const sanitizeFileName = (fileName) => {
  const safeName = path.basename(fileName || 'upload')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '');
  return safeName || 'upload';
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${sanitizeFileName(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', getProducts);
router.get('/locations', getProductLocations);
router.get('/my-products', protect, vendorOnly, getMyProducts);
router.get('/vendor/:vendorId', getVendorProducts);
router.get('/:id', optionalAuth, getProduct);
router.post('/', protect, vendorOnly, upload.array('images', 5), createProduct);
router.put('/:id', protect, updateProduct);
router.put('/:id/renew', protect, renewProduct);
router.delete('/:id', protect, vendorOnly, deleteProduct);

module.exports = router;
