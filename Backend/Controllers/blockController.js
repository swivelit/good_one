const prisma = require('../Db/prisma');
const { toCompat } = require('../utils/serialize');

const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );

exports.blockUser = async (req, res) => {
  try {
    const { blockedUser, conversation } = req.body;

    if (!blockedUser) {
      return res.status(400).json({ success: false, message: 'Blocked user is required.' });
    }
    if (!isUuid(blockedUser)) {
      return res.status(400).json({ success: false, message: 'Invalid blocked user id.' });
    }
    if (conversation && !isUuid(conversation)) {
      return res.status(400).json({ success: false, message: 'Invalid conversation id.' });
    }

    if (blockedUser.toString() === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot block yourself.' });
    }

    const block = await prisma.block.upsert({
      where: {
        blockerId_blockedUserId: {
          blockerId: req.user.id,
          blockedUserId: blockedUser,
        },
      },
      update: {
        conversationId: conversation || null,
      },
      create: {
        blockerId: req.user.id,
        blockedUserId: blockedUser,
        conversationId: conversation || null,
      },
    });

    res.json({
      success: true,
      message: 'User blocked successfully.',
      block: toCompat(block),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
