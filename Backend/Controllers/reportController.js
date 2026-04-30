const prisma = require('../Db/prisma');
const { toCompat } = require('../utils/serialize');

exports.createReport = async (req, res) => {
  try {
    const { product, conversation, message, reportedUser, reason, details } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Report reason is required.' });
    }

    const report = await prisma.report.create({
      data: {
        reporterId: req.user.id,
        reportedUserId: reportedUser || null,
        productId: product || null,
        conversationId: conversation || null,
        messageId: message || null,
        reason: reason.trim(),
        details: details?.trim() || null,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully.',
      report: toCompat(report),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
