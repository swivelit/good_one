const prisma = require('../Db/prisma');
const { assertCleanFields } = require('../utils/contentModeration');
const { toCompat } = require('../utils/serialize');

const conversationInclude = {
  product: { select: { id: true, title: true, images: true, price: true, expiresAt: true } },
  vendor: { select: { id: true, name: true, avatar: true } },
  customer: { select: { id: true, name: true, avatar: true } },
};

const isParticipant = (conversation, userId) =>
  conversation.customerId === userId || conversation.vendorId === userId;

const getOtherParticipantId = (conversation, userId) =>
  conversation.customerId === userId ? conversation.vendorId : conversation.customerId;

const findBlockBetween = (userId, otherUserId) =>
  prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedUserId: otherUserId },
        { blockerId: otherUserId, blockedUserId: userId },
      ],
    },
  });

exports.getOrCreateConversation = async (req, res) => {
  try {
    const { productId } = req.body;
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

    const block = await findBlockBetween(req.user.id, product.vendorUserId);
    if (block) {
      return res.status(403).json({ success: false, message: 'Chat is not available between these users.' });
    }

    let conversation = await prisma.conversation.findUnique({
      where: { productId_customerId: { productId, customerId: req.user.id } },
      include: conversationInclude,
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          productId,
          customerId: req.user.id,
          vendorId: product.vendorUserId,
        },
        include: conversationInclude,
      });
    }

    res.json({ success: true, conversation: toCompat(conversation) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getConversations = async (req, res) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [{ customerId: req.user.id }, { vendorId: req.user.id }],
      },
      include: conversationInclude,
      orderBy: { lastMessageAt: 'desc' },
    });
    res.json({ success: true, conversations: toCompat(conversations) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.conversationId },
    });
    if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found.' });
    if (!isParticipant(conversation, req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: req.params.conversationId },
      include: { sender: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'asc' },
    });

    await prisma.message.updateMany({
      where: {
        conversationId: req.params.conversationId,
        senderId: { not: req.user.id },
        isRead: false,
      },
      data: { isRead: true },
    });

    res.json({ success: true, messages: toCompat(messages) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { text, type, offerPrice, meetupDetails } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Message text is required.' });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.conversationId },
    });
    if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found.' });
    if (!isParticipant(conversation, req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const otherUserId = getOtherParticipantId(conversation, req.user.id);
    const block = await findBlockBetween(req.user.id, otherUserId);
    if (block) {
      return res.status(403).json({ success: false, message: 'Chat is not available between these users.' });
    }

    const messageText = text.trim();
    assertCleanFields({ text: messageText });

    const message = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: req.user.id,
        text: messageText,
        type: type || 'text',
        offerPrice: offerPrice !== undefined && offerPrice !== null ? Number(offerPrice) : null,
        meetupDetails: meetupDetails || undefined,
      },
      include: { sender: { select: { id: true, name: true, avatar: true } } },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessage: messageText,
        lastMessageAt: new Date(),
        unreadCount: { increment: 1 },
      },
    });

    res.status(201).json({ success: true, message: toCompat(message) });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};
