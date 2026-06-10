const prisma = require('../Db/prisma');
const { getMessaging } = require('./firebaseAdmin');

const CHAT_CHANNEL_ID = 'chat_messages';
const MAX_FCM_TOKENS = 500;
const PREVIEW_MAX_LENGTH = 120;

const INVALID_TOKEN_CODES = new Set([
  'messaging/invalid-argument',
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

const toDataValue = (value) => (value === undefined || value === null ? '' : String(value));

const truncatePreview = (value) => {
  const normalized = String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized.length <= PREVIEW_MAX_LENGTH) return normalized;
  return `${normalized.slice(0, PREVIEW_MAX_LENGTH - 3)}...`;
};

const buildNotificationTitle = (sender, conversation) => {
  const senderName = sender?.name || 'GoodOne user';
  const productTitle = conversation?.product?.title;
  if (!productTitle) return `New message from ${senderName}`;
  return `${senderName} about ${productTitle}`;
};

const disableInvalidTokens = async (tokens) => {
  if (!tokens.length) return;

  try {
    await prisma.pushToken.updateMany({
      where: { token: { in: tokens } },
      data: { enabled: false },
    });
  } catch (error) {
    console.error('Failed to disable invalid push tokens', error.message);
  }
};

const sendBatch = async ({ messaging, tokens, notification, data }) => {
  const response = await messaging.sendEachForMulticast({
    tokens,
    notification,
    data,
    android: {
      priority: 'high',
      notification: {
        channelId: CHAT_CHANNEL_ID,
      },
    },
  });

  const invalidTokens = [];
  const failureCodes = {};

  response.responses.forEach((result, index) => {
    if (!result.success) {
      const code = result.error?.code || 'unknown';
      failureCodes[code] = (failureCodes[code] || 0) + 1;
      if (INVALID_TOKEN_CODES.has(code)) {
        invalidTokens.push(tokens[index]);
      }
    }
  });

  if (Object.keys(failureCodes).length) {
    console.warn('Chat push notification failures', failureCodes);
  }

  await disableInvalidTokens(invalidTokens);
};

exports.sendListingExpiryNotification = async ({ vendorUserId, product }) => {
  try {
    if (!vendorUserId || !product) return;

    const messaging = getMessaging();
    if (!messaging) return;

    const pushTokens = await prisma.pushToken.findMany({
      where: {
        userId: vendorUserId,
        enabled: true,
      },
      select: { token: true },
    });

    const tokens = pushTokens.map((entry) => entry.token).filter(Boolean);
    if (!tokens.length) return;

    const productId = product.id || product._id;
    const productTitle = product.title || 'listing';

    const notification = {
      title: truncatePreview(`Your listing '${productTitle}' expires soon`),
      body: 'Renew it from your dashboard to keep it visible.',
    };

    const data = {
      type: 'listing-expiry',
      route: '/dashboard',
      productId: toDataValue(productId),
    };

    for (let index = 0; index < tokens.length; index += MAX_FCM_TOKENS) {
      const batchTokens = tokens.slice(index, index + MAX_FCM_TOKENS);
      await sendBatch({ messaging, tokens: batchTokens, notification, data });
    }
  } catch (error) {
    console.error('Failed to send listing expiry push notification', error.message);
  }
};

exports.sendChatNotification = async ({
  recipientUserId,
  sender,
  conversation,
  message,
}) => {
  try {
    if (!recipientUserId || sender?.id === recipientUserId || sender?._id === recipientUserId) {
      return;
    }

    const messaging = getMessaging();
    if (!messaging) return;

    const pushTokens = await prisma.pushToken.findMany({
      where: {
        userId: recipientUserId,
        enabled: true,
      },
      select: { token: true },
    });

    const tokens = pushTokens.map((entry) => entry.token).filter(Boolean);
    if (!tokens.length) return;

    const conversationId = conversation?.id || conversation?._id || message?.conversationId;
    const senderId = sender?.id || sender?._id || message?.senderId;
    const messageId = message?.id || message?._id;
    const productId = conversation?.productId || conversation?.product?.id || conversation?.product?._id;

    const notification = {
      title: truncatePreview(buildNotificationTitle(sender, conversation)),
      body: truncatePreview(message?.text) || 'You have a new chat message.',
    };

    const data = {
      type: 'chat',
      route: `/chat/${conversationId}`,
      conversationId: toDataValue(conversationId),
      messageId: toDataValue(messageId),
      senderId: toDataValue(senderId),
      productId: toDataValue(productId),
    };

    for (let index = 0; index < tokens.length; index += MAX_FCM_TOKENS) {
      const batchTokens = tokens.slice(index, index + MAX_FCM_TOKENS);
      await sendBatch({ messaging, tokens: batchTokens, notification, data });
    }
  } catch (error) {
    console.error('Failed to send chat push notification', error.message);
  }
};
