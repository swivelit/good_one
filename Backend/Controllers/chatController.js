const Conversation = require('../Models/Conversation');
const Message = require('../Models/Message');
const Product = require('../Models/Product');
const Block = require('../Models/Block');

const isParticipant = (conversation, userId) =>
  conversation.customer.toString() === userId.toString() ||
  conversation.vendor.toString() === userId.toString();

const getOtherParticipantId = (conversation, userId) =>
  conversation.customer.toString() === userId.toString()
    ? conversation.vendor
    : conversation.customer;

const findBlockBetween = (userId, otherUserId) =>
  Block.findOne({
    $or: [
      { blocker: userId, blockedUser: otherUserId },
      { blocker: otherUserId, blockedUser: userId },
    ],
  });

// @desc  Get or create conversation
// @route POST /api/chat/conversation
exports.getOrCreateConversation = async (req, res) => {
  try {
    const { productId } = req.body;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

    const block = await findBlockBetween(req.user._id, product.vendorUser);
    if (block) {
      return res.status(403).json({ success: false, message: 'Chat is not available between these users.' });
    }

    let conv = await Conversation.findOne({
      product: productId,
      customer: req.user._id,
    }).populate('product', 'title images price').populate('vendor', 'name avatar').populate('customer', 'name avatar');

    if (!conv) {
      conv = await Conversation.create({
        product: productId,
        customer: req.user._id,
        vendor: product.vendorUser,
      });
      conv = await Conversation.findById(conv._id)
        .populate('product', 'title images price')
        .populate('vendor', 'name avatar')
        .populate('customer', 'name avatar');
    }
    res.json({ success: true, conversation: conv });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get user conversations
// @route GET /api/chat/conversations
exports.getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      $or: [{ customer: req.user._id }, { vendor: req.user._id }],
    })
      .populate('product', 'title images price expiresAt')
      .populate('vendor', 'name avatar')
      .populate('customer', 'name avatar')
      .sort({ lastMessageAt: -1 });
    res.json({ success: true, conversations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get messages in a conversation
// @route GET /api/chat/:conversationId/messages
exports.getMessages = async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.conversationId);
    if (!conv) return res.status(404).json({ success: false, message: 'Conversation not found.' });
    const isParticipant =
      conv.customer.toString() === req.user._id.toString() ||
      conv.vendor.toString() === req.user._id.toString();
    if (!isParticipant) return res.status(403).json({ success: false, message: 'Not authorized.' });

    const messages = await Message.find({ conversation: req.params.conversationId })
      .populate('sender', 'name avatar')
      .sort({ createdAt: 1 });
    // Mark as read
    await Message.updateMany(
      { conversation: req.params.conversationId, sender: { $ne: req.user._id }, isRead: false },
      { isRead: true }
    );
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Send message
// @route POST /api/chat/:conversationId/messages
exports.sendMessage = async (req, res) => {
  try {
    const { text, type, offerPrice, meetupDetails } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Message text is required.' });
    }

    const conv = await Conversation.findById(req.params.conversationId);
    if (!conv) return res.status(404).json({ success: false, message: 'Conversation not found.' });
    if (!isParticipant(conv, req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const otherUserId = getOtherParticipantId(conv, req.user._id);
    const block = await findBlockBetween(req.user._id, otherUserId);
    if (block) {
      return res.status(403).json({ success: false, message: 'Chat is not available between these users.' });
    }

    const message = await Message.create({
      conversation: conv._id,
      sender: req.user._id,
      text: text.trim(), type: type || 'text',
      offerPrice, meetupDetails,
    });

    conv.lastMessage = text.trim();
    conv.lastMessageAt = new Date();
    conv.unreadCount += 1;
    await conv.save();

    const populated = await Message.findById(message._id).populate('sender', 'name avatar');
    res.status(201).json({ success: true, message: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
