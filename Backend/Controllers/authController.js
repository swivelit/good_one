const bcrypt = require('bcryptjs');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const path = require('path');
const prisma = require('../Db/prisma');
const { uploadsDir } = require('../config/uploads');
const { sanitizeUser, toCompat } = require('../utils/serialize');
const mailSender = require('../utills/sendMail');

const OTP_EXPIRES_MS = 5 * 60 * 1000;

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

const generateAdminToken = () =>
  jwt.sign({ id: 'admin', role: 'admin' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });

const isEmailLike = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const getTrimmedEnv = (name) => {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
};

const getAdminCredentials = () => {
  const adminUsername = getTrimmedEnv('ADMIN_USERNAME');
  const adminPassword = getTrimmedEnv('ADMIN_PASSWORD');

  if (adminUsername && adminPassword) {
    return { username: adminUsername, password: adminPassword, source: 'ADMIN_*' };
  }

  const fallbackUsername = getTrimmedEnv('username');
  const fallbackPassword = getTrimmedEnv('password');

  if (fallbackUsername && fallbackPassword) {
    console.warn(
      'Admin login is using fallback lowercase username/password env vars. ' +
      'Set ADMIN_USERNAME and ADMIN_PASSWORD in Render backend env.'
    );
    return { username: fallbackUsername, password: fallbackPassword, source: 'lowercase-fallback' };
  }

  return null;
};

const isAdminUsernameMatch = (enteredLogin, configuredUsername) => {
  const entered = String(enteredLogin || '').trim();
  const configured = String(configuredUsername || '').trim();

  if (!entered || !configured) return false;

  if (isEmailLike(entered) && isEmailLike(configured)) {
    return entered.toLowerCase() === configured.toLowerCase();
  }

  return entered === configured;
};

const isAdminLoginMatch = ({ loginId, password }) => {
  const credentials = getAdminCredentials();
  if (!credentials) return null;

  if (
    isAdminUsernameMatch(loginId, credentials.username) &&
    password === credentials.password
  ) {
    return credentials;
  }

  return null;
};

const isOtpExpired = (otp) =>
  !otp?.createdAt || Date.now() - new Date(otp.createdAt).getTime() > OTP_EXPIRES_MS;

const deleteExpiredOtps = () =>
  prisma.otp.deleteMany({
    where: {
      createdAt: { lt: new Date(Date.now() - OTP_EXPIRES_MS) },
    },
  });

const isTestOtpEnabled = () =>
  process.env.ENABLE_TEST_OTP === 'true' &&
  Boolean(process.env.OTP_BYPASS_CODE);

const generatePasswordResetOtp = () =>
  isTestOtpEnabled()
    ? process.env.OTP_BYPASS_CODE
    : Math.floor(100000 + Math.random() * 900000).toString();

const passwordResetEmailBody = (otp) => `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <h2 style="color: #2c3e50;">GoodOne Password Reset</h2>
    <p>Hello,</p>
    <p>Use the One-Time Password (OTP) below to reset your GoodOne password:</p>
    <div style="margin: 20px 0; text-align: center;">
      <span style="font-size: 24px; font-weight: bold; color: #ffffff; background: #007bff; padding: 10px 20px; border-radius: 5px;">
        ${otp}
      </span>
    </div>
    <p>This OTP is valid for <strong>5 minutes</strong>. Do not share it with anyone.</p>
    <p>If you did not request a password reset, please ignore this email.</p>
    <br/>
    <p>Regards,</p>
    <p><strong>GoodOne Team</strong></p>
  </div>
`;

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

    const adminCredentials = isAdminLoginMatch({ loginId, password });

    if (adminCredentials) {
      return res.json({
        success: true,
        token: generateAdminToken(),
        user: {
          id: 'admin',
          name: 'Administrator',
          role: 'admin',
          email: adminCredentials.username,
        },
        vendorProfile: null,
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

exports.requestPasswordResetOtp = async (req, res) => {
  try {
    const normalizedEmail = req.body.email?.toLowerCase().trim();

    if (!normalizedEmail) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'This email is not registered',
      });
    }

    const otp = generatePasswordResetOtp();

    await deleteExpiredOtps();
    await prisma.otp.deleteMany({ where: { email: normalizedEmail } });
    await prisma.otp.create({ data: { email: normalizedEmail, otp } });

    if (isTestOtpEnabled()) {
      return res.status(200).json({
        success: true,
        message: 'OTP sent to your email',
        testOtpEnabled: true,
      });
    }

    await mailSender(
      normalizedEmail,
      'Password Reset OTP - GoodOne',
      passwordResetEmailBody(otp)
    );

    res.status(200).json({
      success: true,
      message: 'OTP sent to your email',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const normalizedEmail = req.body.email?.toLowerCase().trim();
    const otp = req.body.otp?.toString().trim();
    const { newPassword } = req.body;

    if (!normalizedEmail || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, OTP, and new password are required',
      });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'This email is not registered',
      });
    }

    const recentOtp = await prisma.otp.findFirst({
      where: { email: normalizedEmail },
      orderBy: { createdAt: 'desc' },
    });

    if (!recentOtp || isOtpExpired(recentOtp) || recentOtp.otp.toString() !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP',
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });
      await tx.otp.deleteMany({ where: { email: normalizedEmail } });
    });

    res.status(200).json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAdminCredentials = getAdminCredentials;
exports.isAdminLoginMatch = isAdminLoginMatch;

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

exports.registerPushToken = async (req, res) => {
  try {
    const token = String(req.body.token || '').trim();
    const platform = req.body.platform ? String(req.body.platform).trim() : null;
    const deviceId = req.body.deviceId ? String(req.body.deviceId).trim() : null;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Push token is required.' });
    }

    await prisma.pushToken.upsert({
      where: { token },
      update: {
        userId: req.user.id,
        platform,
        deviceId,
        enabled: true,
      },
      create: {
        userId: req.user.id,
        token,
        platform,
        deviceId,
        enabled: true,
      },
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deletePushToken = async (req, res) => {
  try {
    const token = String(req.body.token || '').trim();

    if (!token) {
      return res.status(400).json({ success: false, message: 'Push token is required.' });
    }

    await prisma.pushToken.updateMany({
      where: {
        token,
        userId: req.user.id,
      },
      data: { enabled: false },
    });

    res.json({ success: true });
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
