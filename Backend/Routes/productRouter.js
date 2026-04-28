const express = require('express');
const router = express.Router();
const {
  getProducts, getProduct, createProduct, updateProduct,
  renewProduct, deleteProduct, getMyProducts, getVendorProducts,
} = require('../Controllers/productController');
const { protect, vendorOnly } = require('../middleware/auth');
const multer = require('multer');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', getProducts);
router.get('/my-products', protect, vendorOnly, getMyProducts);
router.get('/vendor/:vendorId', getVendorProducts);
router.get('/:id', getProduct);
router.post('/', protect, vendorOnly, upload.array('images', 5), createProduct);
router.put('/:id', protect, vendorOnly, updateProduct);
router.put('/:id/renew', protect, vendorOnly, renewProduct);
router.delete('/:id', protect, vendorOnly, deleteProduct);

module.exports = router;
