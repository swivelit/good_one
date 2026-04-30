const nodemailer = require("nodemailer");

const mailSender = async (email, title, body) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error("Email service is not configured");
    }

    const auth = {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    };

    const transporterConfig = process.env.EMAIL_HOST
      ? {
          host: process.env.EMAIL_HOST,
          port: Number(process.env.EMAIL_PORT || 587),
          secure: process.env.EMAIL_SECURE === "true",
          auth,
        }
      : {
          service: "gmail",
          auth,
        };

    let transporter = nodemailer.createTransport(transporterConfig);

    let info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"GoodOne" <${process.env.EMAIL_USER}>`,
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
