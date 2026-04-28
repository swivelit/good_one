const express = require("express");
const router = express.Router();

const { sendOtp, resendOtp } = require("../Controllers/otpController");

router.post("/sendOtp", sendOtp);
router.post("/resendOtp", resendOtp);

module.exports = router;
