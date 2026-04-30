const isPlainObject = (value) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  !(value instanceof Date);

const toCompat = (value) => {
  if (Array.isArray(value)) return value.map(toCompat);
  if (!isPlainObject(value)) return value;

  const out = {};

  Object.entries(value).forEach(([key, entry]) => {
    out[key] = toCompat(entry);
  });

  if (value.id && !out._id) out._id = value.id;

  if (value.userId && !out.user) out.user = value.userId;
  if (value.vendorId && !out.vendor) out.vendor = value.vendorId;
  if (value.vendorUserId && !out.vendorUser) out.vendorUser = value.vendorUserId;
  if (value.productId && !out.product) out.product = value.productId;
  if (value.customerId && !out.customer) out.customer = value.customerId;
  if (value.conversationId && !out.conversation) out.conversation = value.conversationId;
  if (value.senderId && !out.sender) out.sender = value.senderId;
  if (value.reporterId && !out.reporter) out.reporter = value.reporterId;
  if (value.reportedUserId && !out.reportedUser) out.reportedUser = value.reportedUserId;
  if (value.blockerId && !out.blocker) out.blocker = value.blockerId;
  if (value.blockedUserId && !out.blockedUser) out.blockedUser = value.blockedUserId;

  return out;
};

const sanitizeUser = (user) => {
  if (!user) return user;
  const out = toCompat(user);
  delete out.password;
  return out;
};

module.exports = {
  sanitizeUser,
  toCompat,
};
