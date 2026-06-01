const express = require('express');

const router = express.Router();

const DEFAULT_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.goodone.marketplace';

const parseVersionCode = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

router.get('/', (req, res) => {
  const minSupportedVersionCode = parseVersionCode(
    process.env.MIN_SUPPORTED_ANDROID_VERSION_CODE,
    0,
  );
  const latestVersionCode = parseVersionCode(
    process.env.LATEST_ANDROID_VERSION_CODE,
    minSupportedVersionCode,
  );
  const playStoreUrl = process.env.PLAY_STORE_URL || DEFAULT_PLAY_STORE_URL;
  const platform = String(req.query.platform || '').toLowerCase();
  const requestedVersionCode = Number.parseInt(req.query.versionCode, 10);
  const hasValidVersionCode = Number.isFinite(requestedVersionCode) && requestedVersionCode >= 0;
  const updateRequired =
    platform === 'android' &&
    minSupportedVersionCode > 0 &&
    (!hasValidVersionCode || requestedVersionCode < minSupportedVersionCode);

  res.json({
    success: true,
    android: {
      minSupportedVersionCode,
      latestVersionCode,
      updateRequired,
    },
    playStoreUrl,
    message: 'Please update GoodOne to continue.',
  });
});

module.exports = router;
