const User = require('../Models/User');
const Vendor = require('../Models/Vendor');
const Product = require('../Models/Product');
const Conversation = require('../Models/Conversation');
const Message = require('../Models/Message');
const jwt = require('jsonwebtoken');
const OTP = require('../Models/otp');
const fs = require('fs');
const path = require('path');
const { uploadsDir } = require('../config/uploads');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

const deleteUploadedFile = async (fileName) => {
  if (!fileName || /^https?:\/\//i.test(fileName)) return;

  const filePath = path.join(uploadsDir, path.basename(fileName));

  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`Failed to delete uploaded file: ${path.basename(fileName)}`);
    }
  }
};

exports.registerCustomer = async (req, res) => {
  try {
    const { name, email, phone, password, otp } = req.body;

    if (!name || !email || !password || !otp) {
      return res.status(400).json({
        success: false,
        message: 'All fields including OTP are required',
      });
    }

    const recentOtp = await OTP.find({ email })
      .sort({ createdAt: -1 })
      .limit(1);

    if (recentOtp.length === 0 || recentOtp[0].otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP',
      });
    }

    const existing = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'User already exists',
      });
    }

    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: 'customer',
    });

    await OTP.deleteMany({ email });

    res.status(201).json({
      success: true,
      token: generateToken(user._id),
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.registerVendor = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      otp,
      businessName,
      businessDescription,
      businessCategory,
      businessAddress,
    } = req.body;

    if (!name || !email || !phone || !password || !otp || !businessName) {
      return res.status(400).json({
        success: false,
        message: 'All required fields missing',
      });
    }

    const recentOtp = await OTP.find({ email })
      .sort({ createdAt: -1 })
      .limit(1);

    if (recentOtp.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'OTP expired',
      });
    }

    if (recentOtp[0].otp.toString() !== otp.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP',
      });
    }

    const existing = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'User already exists',
      });
    }

    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: 'vendor',
    });

    const livePhoto = req.files?.livePhoto?.[0]?.filename || '';
    const liveVideo = req.files?.liveVideo?.[0]?.filename || '';

    const vendor = await Vendor.create({
      user: user._id,
      businessName,
      businessDescription,
      businessCategory,
      businessAddress,
      livePhoto,
      liveVideo,
    });

    await OTP.deleteMany({ email });

    res.status(201).json({
      success: true,
      token: generateToken(user._id),
      user,
      vendor,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;

    const user = await User.findOne({
      $or: [
        { email: emailOrPhone },
        { phone: emailOrPhone },
      ],
    });

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    let vendorProfile = null;

    if (user.role === 'vendor') {
      vendorProfile = await Vendor.findOne({ user: user._id });
    }

    res.json({
      success: true,
      token: generateToken(user._id),
      user,
      vendorProfile,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = req.user;

    let vendorProfile = null;

    if (user.role === 'vendor') {
      vendorProfile = await Vendor.findOne({ user: user._id });
    }

    res.json({
      success: true,
      user,
      vendorProfile,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteMe = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const filesToDelete = [];

    if (user.avatar) {
      filesToDelete.push(user.avatar);
    }

    const vendorProfile = await Vendor.findOne({ user: userId });

    if (vendorProfile) {
      filesToDelete.push(
        vendorProfile.logo,
        vendorProfile.coverImage,
        vendorProfile.livePhoto,
        vendorProfile.liveVideo
      );
    }

    const productQuery = vendorProfile
      ? { $or: [{ vendorUser: userId }, { vendor: vendorProfile._id }] }
      : { vendorUser: userId };

    const products = await Product.find(productQuery).select('images');

    products.forEach((product) => {
      if (Array.isArray(product.images)) {
        filesToDelete.push(...product.images);
      }
    });

    const conversations = await Conversation.find({
      $or: [{ customer: userId }, { vendor: userId }],
    }).select('_id');
    const conversationIds = conversations.map((conversation) => conversation._id);

    if (conversationIds.length) {
      await Message.deleteMany({ conversation: { $in: conversationIds } });
      await Conversation.deleteMany({ _id: { $in: conversationIds } });
    }

    if (products.length) {
      await Product.deleteMany({ _id: { $in: products.map((product) => product._id) } });
    }

    if (vendorProfile) {
      await Vendor.deleteOne({ _id: vendorProfile._id });
    }

    if (user.email) {
      await OTP.deleteMany({ email: user.email });
    }

    await User.deleteOne({ _id: userId });
    await Promise.allSettled(filesToDelete.map(deleteUploadedFile));

    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
