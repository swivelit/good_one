const otpGenerator = require("otp-generator");
const OTP = require("../Models/otp");
const User = require("../Models/User");
const mailSender = require("../utills/sendMail");

exports.sendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    // Check user already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already registered",
      });
    }

    // Generate OTP
    const otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });

    // Delete old OTPs
    await OTP.deleteMany({ email });

    // Save OTP
    await OTP.create({ email, otp });

    // Send email
   await mailSender(
  email,
  "Your OTP Code - Good_one",
  `
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
  `
);


    res.status(200).json({
      success: true,
      message: "OTP sent successfully",
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

    const existingOtp = await OTP.findOne({ email }).sort({ createdAt: -1 });

    // ⏱️ Check cooldown
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

    // 🔁 Generate new OTP
    const otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });

    // 🗑️ Delete old OTP
    await OTP.deleteMany({ email });

    // ⏱️ Set cooldown (30 seconds)
    const resendBlockedUntil = new Date(Date.now() + 30 * 1000);

    // 💾 Save new OTP
    await OTP.create({
      email,
      otp,
      resendBlockedUntil,
    });

    // 📩 Send email
    await mailSender(
  email,
  "Your OTP Code - Good_one",
  `
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
  `
);


    res.status(200).json({
      success: true,
      message: "OTP resent successfully",
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};




