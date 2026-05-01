const prisma = require('../Db/prisma');
const { toCompat } = require('../utils/serialize');

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );

exports.createReport = async (req, res) => {
  try {
    const { product, conversation, message, reportedUser, reason, details } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Report reason is required.' });
    }
    for (const [label, value] of Object.entries({ product, conversation, message, reportedUser })) {
      if (value && !isUuid(value)) {
        return res.status(400).json({ success: false, message: `Invalid ${label} id.` });
      }
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
