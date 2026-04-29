const nodemailer = require("nodemailer");

const mailSender = async (email, title, body) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error("Email service is not configured");
    }

    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    let info = await transporter.sendMail({
      from: `"Auth System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: title,
      html: body,
    });

    return info;
  } catch (error) {
    console.error(`Email delivery failed: ${error.message}`);
    throw new Error(`Email delivery failed: ${error.message}`);
  }
};

module.exports = mailSender;
