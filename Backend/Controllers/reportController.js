const Report = require('../Models/Report');

exports.createReport = async (req, res) => {
  try {
    const { product, conversation, message, reportedUser, reason, details } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Report reason is required.' });
    }

    const report = await Report.create({
      reporter: req.user._id,
      reportedUser,
      product,
      conversation,
      message,
      reason: reason.trim(),
      details: details?.trim(),
    });

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully.',
      report,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
