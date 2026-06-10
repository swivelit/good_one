const cron = require('node-cron');
const prisma = require('../Db/prisma');
const { sendListingExpiryNotification } = require('./pushNotificationService');

// Notify vendors when an active listing is within this window of expiring.
const EXPIRY_WINDOW_MINUTES = 60;
const CRON_EXPRESSION = '*/15 * * * *'; // every 15 minutes

let isRunning = false;
let task = null;

const runExpirySweep = async () => {
  // Guard against overlapping runs (a slow FCM batch must not collide with the
  // next 15-minute tick).
  if (isRunning) {
    console.warn('Listing expiry sweep skipped: previous run still in progress');
    return { skipped: true };
  }
  isRunning = true;

  let notified = 0;
  try {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + EXPIRY_WINDOW_MINUTES * 60 * 1000);

    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        expiryNotifiedAt: null,
        expiresAt: { gt: now, lte: windowEnd },
      },
      select: { id: true, title: true, vendorUserId: true },
    });

    for (const product of products) {
      await sendListingExpiryNotification({
        vendorUserId: product.vendorUserId,
        product,
      });

      // Mark as notified regardless of token availability so each near-expiry
      // listing triggers at most one alert.
      await prisma.product.update({
        where: { id: product.id },
        data: { expiryNotifiedAt: new Date() },
      });
      notified += 1;
    }

    if (notified) {
      console.log(`Listing expiry sweep notified ${notified} listing(s)`);
    }
    return { notified };
  } catch (error) {
    console.error('Listing expiry sweep failed', error.message);
    return { error: error.message };
  } finally {
    isRunning = false;
  }
};

const startListingExpiryScheduler = () => {
  if (task) return task;
  task = cron.schedule(CRON_EXPRESSION, () => {
    void runExpirySweep();
  });
  console.log(`Listing expiry scheduler started (every 15 min, ${EXPIRY_WINDOW_MINUTES}-min window)`);
  return task;
};

module.exports = {
  startListingExpiryScheduler,
  runExpirySweep,
  EXPIRY_WINDOW_MINUTES,
};
