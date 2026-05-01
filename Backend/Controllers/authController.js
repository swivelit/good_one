const bcrypt = require('bcryptjs');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const path = require('path');
const prisma = require('../Db/prisma');
const { uploadsDir } = require('../config/uploads');
const { sanitizeUser, toCompat } = require('../utils/serialize');

const OTP_EXPIRES_MS = 5 * 60 * 1000;

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

const isOtpExpired = (otp) =>
  !otp?.createdAt || Date.now() - new Date(otp.createdAt).getTime() > OTP_EXPIRES_MS;

const userLookupWhere = (email, phone) => {
  const filters = [];
  if (email) filters.push({ email: email.toLowerCase() });
  if (phone) filters.push({ phone });
  return filters.length ? { OR: filters } : {};
};

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
    const normalizedEmail = email?.toLowerCase().trim();

    if (!name || !normalizedEmail || !password || !otp) {
      return res.status(400).json({
        success: false,
        message: 'All fields including OTP are required',
      });
    }

    const recentOtp = await prisma.otp.findFirst({
      where: { email: normalizedEmail },
      orderBy: { createdAt: 'desc' },
    });

    if (!recentOtp || isOtpExpired(recentOtp) || recentOtp.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP',
      });
    }

    const existing = await prisma.user.findFirst({
      where: userLookupWhere(normalizedEmail, phone),
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'User already exists',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        phone: phone || null,
        password: hashedPassword,
        role: 'customer',
      },
    });

    await prisma.otp.deleteMany({ where: { email: normalizedEmail } });

    res.status(201).json({
      success: true,
      token: generateToken(user.id),
      user: sanitizeUser(user),
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
    const normalizedEmail = email?.toLowerCase().trim();

    if (!name || !normalizedEmail || !phone || !password || !otp || !businessName) {
      return res.status(400).json({
        success: false,
        message: 'All required fields missing',
      });
    }

    const recentOtp = await prisma.otp.findFirst({
      where: { email: normalizedEmail },
      orderBy: { createdAt: 'desc' },
    });

    if (!recentOtp || isOtpExpired(recentOtp)) {
      return res.status(400).json({
        success: false,
        message: 'OTP expired',
      });
    }

    if (recentOtp.otp.toString() !== otp.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP',
      });
    }

    const existing = await prisma.user.findFirst({
      where: userLookupWhere(normalizedEmail, phone),
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'User already exists',
      });
    }

    const livePhoto = req.files?.livePhoto?.[0]?.filename || '';
    const liveVideo = req.files?.liveVideo?.[0]?.filename || '';
    const hashedPassword = await bcrypt.hash(password, 12);

    const { user, vendor } = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name,
          email: normalizedEmail,
          phone,
          password: hashedPassword,
          role: 'vendor',
        },
      });

      const createdVendor = await tx.vendor.create({
        data: {
          userId: createdUser.id,
          businessName,
          businessDescription,
          businessCategory,
          businessAddress,
          livePhoto,
          liveVideo,
        },
      });

      await tx.otp.deleteMany({ where: { email: normalizedEmail } });

      return { user: createdUser, vendor: createdVendor };
    });

    res.status(201).json({
      success: true,
      token: generateToken(user.id),
      user: sanitizeUser(user),
      vendor: toCompat(vendor),
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
    const loginId = emailOrPhone?.trim();

    if (!loginId || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email/phone and password are required',
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: loginId.toLowerCase() },
          { phone: loginId },
        ],
      },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    let vendorProfile = null;

    if (user.role === 'vendor') {
      vendorProfile = await prisma.vendor.findUnique({ where: { userId: user.id } });
    }

    res.json({
      success: true,
      token: generateToken(user.id),
      user: sanitizeUser(user),
      vendorProfile: toCompat(vendorProfile),
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
      vendorProfile = await prisma.vendor.findUnique({ where: { userId: user.id } });
    }

    res.json({
      success: true,
      user: sanitizeUser(user),
      vendorProfile: toCompat(vendorProfile),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const name = String(req.body.name || '').trim();
    const phone =
      req.body.phone === undefined || req.body.phone === null
        ? undefined
        : String(req.body.phone).trim();

    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required.' });
    }

    if (phone) {
      const existingPhoneUser = await prisma.user.findFirst({
        where: {
          phone,
          NOT: { id: userId },
        },
      });

      if (existingPhoneUser) {
        return res.status(400).json({ success: false, message: 'Phone number is already in use.' });
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        ...(phone !== undefined ? { phone: phone || null } : {}),
      },
    });

    res.json({
      success: true,
      user: sanitizeUser(user),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const filesToDelete = [];

    if (user.avatar) {
      filesToDelete.push(user.avatar);
    }

    const vendorProfile = await prisma.vendor.findUnique({ where: { userId } });

    if (vendorProfile) {
      filesToDelete.push(
        vendorProfile.logo,
        vendorProfile.coverImage,
        vendorProfile.livePhoto,
        vendorProfile.liveVideo
      );
    }

    const productWhere = vendorProfile
      ? { OR: [{ vendorUserId: userId }, { vendorId: vendorProfile.id }] }
      : { vendorUserId: userId };

    const products = await prisma.product.findMany({
      where: productWhere,
      select: { id: true, images: true },
    });

    products.forEach((product) => {
      if (Array.isArray(product.images)) {
        filesToDelete.push(...product.images);
      }
    });

    const conversations = await prisma.conversation.findMany({
      where: { OR: [{ customerId: userId }, { vendorId: userId }] },
      select: { id: true },
    });
    const conversationIds = conversations.map((conversation) => conversation.id);
    const productIds = products.map((product) => product.id);

    await prisma.$transaction(async (tx) => {
      if (conversationIds.length) {
        await tx.message.deleteMany({ where: { conversationId: { in: conversationIds } } });
        await tx.conversation.deleteMany({ where: { id: { in: conversationIds } } });
      }

      if (productIds.length) {
        await tx.product.deleteMany({ where: { id: { in: productIds } } });
      }

      if (vendorProfile) {
        await tx.vendor.delete({ where: { id: vendorProfile.id } });
      }

      if (user.email) {
        await tx.otp.deleteMany({ where: { email: user.email } });
      }

      await tx.user.delete({ where: { id: userId } });
    });

    await Promise.allSettled(filesToDelete.map(deleteUploadedFile));

    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
