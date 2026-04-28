const Conversation = require('../Models/Conversation');
const Message = require('../Models/Message');
const Product = require('../Models/Product');

// @desc  Get or create conversation
// @route POST /api/chat/conversation
exports.getOrCreateConversation = async (req, res) => {
  try {
    const { productId } = req.body;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

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
    const conv = await Conversation.findById(req.params.conversationId);
    if (!conv) return res.status(404).json({ success: false, message: 'Conversation not found.' });

    const message = await Message.create({
      conversation: conv._id,
      sender: req.user._id,
      text, type: type || 'text',
      offerPrice, meetupDetails,
    });

    conv.lastMessage = text;
    conv.lastMessageAt = new Date();
    conv.unreadCount += 1;
    await conv.save();

    const populated = await Message.findById(message._id).populate('sender', 'name avatar');
    res.status(201).json({ success: true, message: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
