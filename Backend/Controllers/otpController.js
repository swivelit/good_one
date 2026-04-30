const otpGenerator = require('otp-generator');
const prisma = require('../Db/prisma');
const mailSender = require('../utills/sendMail');

const OTP_EXPIRY_MS = 5 * 60 * 1000;

const generateOtp = () =>
  otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    lowerCaseAlphabets: false,
    specialChars: false,
  });

const getOtpForRequest = () => process.env.OTP_BYPASS_CODE || generateOtp();

const otpEmailBody = (otp) => `
  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <h2 style="color: #2c3e50;">Good_one Verification</h2>
    <p>Hello,</p>
    <p>Thank you for choosing <strong>Good_one</strong>. To proceed with your request, please use the One-Time Password (OTP) below:</p>
    <div style="margin: 20px 0; text-align: center;">
      <span style="font-size: 24px; font-weight: bold; color: #ffffff; background: #007bff; padding: 10px 20px; border-radius: 5px;">
        ${otp}
      </span>
    </div>
    <p>This OTP is valid for <strong>5 minutes</strong>. Please do not share it with anyone for security reasons.</p>
    <p>If you did not request this, please ignore this email.</p>
    <br/>
    <p>Regards,</p>
    <p><strong>Good_one Team</strong></p>
  </div>
`;

const deleteExpiredOtps = () =>
  prisma.otp.deleteMany({
    where: {
      createdAt: { lt: new Date(Date.now() - OTP_EXPIRY_MS) },
    },
  });

exports.sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = email?.toLowerCase().trim();

    if (!normalizedEmail) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already registered',
      });
    }

    const otp = getOtpForRequest();

    await deleteExpiredOtps();
    await prisma.otp.deleteMany({ where: { email: normalizedEmail } });
    await prisma.otp.create({ data: { email: normalizedEmail, otp } });

    if (process.env.OTP_BYPASS_CODE) {
      return res.status(200).json({
        success: true,
        message: 'Test OTP generated successfully',
        testOtpEnabled: true,
      });
    }

    await mailSender(normalizedEmail, 'Your OTP Code - Good_one', otpEmailBody(otp));

    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.resendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = email?.toLowerCase().trim();

    if (!normalizedEmail) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    await deleteExpiredOtps();

    const existingOtp = await prisma.otp.findFirst({
      where: { email: normalizedEmail },
      orderBy: { createdAt: 'desc' },
    });

    if (
      existingOtp &&
      existingOtp.resendBlockedUntil &&
      existingOtp.resendBlockedUntil > new Date()
    ) {
      const remainingTime = Math.ceil(
        (existingOtp.resendBlockedUntil - new Date()) / 1000
      );

      return res.status(429).json({
        success: false,
        message: `Please wait ${remainingTime} seconds before resending OTP`,
      });
    }

    const otp = getOtpForRequest();
    const resendBlockedUntil = new Date(Date.now() + 30 * 1000);

    await prisma.otp.deleteMany({ where: { email: normalizedEmail } });
    await prisma.otp.create({
      data: {
        email: normalizedEmail,
        otp,
        resendBlockedUntil,
      },
    });

    if (process.env.OTP_BYPASS_CODE) {
      return res.status(200).json({
        success: true,
        message: 'Test OTP resent successfully',
        testOtpEnabled: true,
      });
    }

    await mailSender(normalizedEmail, 'Your OTP Code - Good_one', otpEmailBody(otp));

    res.status(200).json({
      success: true,
      message: 'OTP resent successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
