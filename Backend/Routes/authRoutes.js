const express = require('express');
const router = express.Router();

const {
  registerCustomer,
  registerVendor,
  login,
  requestPasswordResetOtp,
  resetPassword,
  getMe,
  updateMe,
  deleteMe,
} = require('../Controllers/authController');

const { protect } = require('../middleware/auth');

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
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },

  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${sanitizeFileName(file.originalname)}`);
  },
});

const upload = multer({ storage });

router.post('/register/customer', registerCustomer);

router.post(
  '/register/vendor',
  upload.fields([
    { name: 'livePhoto', maxCount: 1 },
    { name: 'liveVideo', maxCount: 1 },
  ]),
  registerVendor
);

router.post('/login', login);
router.post('/forgot-password/send-otp', requestPasswordResetOtp);
router.post('/forgot-password/reset', resetPassword);

router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);
router.delete('/me', protect, deleteMe);

module.exports = router;
