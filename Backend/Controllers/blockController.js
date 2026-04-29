const Block = require('../Models/Block');

exports.blockUser = async (req, res) => {
  try {
    const { blockedUser, conversation } = req.body;

    if (!blockedUser) {
      return res.status(400).json({ success: false, message: 'Blocked user is required.' });
    }

    if (blockedUser.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot block yourself.' });
    }

    const block = await Block.findOneAndUpdate(
      { blocker: req.user._id, blockedUser },
      { blocker: req.user._id, blockedUser, conversation },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({
      success: true,
      message: 'User blocked successfully.',
      block,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
