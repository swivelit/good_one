const DEFAULT_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.goodone.marketplace';

const parseVersionCode = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const isAllowedPath = (path) => (
  path === '/api/app-config' ||
  path.startsWith('/api/app-config/') ||
  path === '/api/health' ||
  path.startsWith('/api/health/')
);

const isNativeAndroidRequest = (req) => {
  const platform = String(req.get('X-App-Platform') || '').toLowerCase();
  const origin = String(req.get('Origin') || '').toLowerCase();

  return (
    platform === 'android' ||
    origin === 'capacitor://localhost' ||
    origin === 'ionic://localhost'
  );
};

const appVersionGate = (req, res, next) => {
  if (req.method === 'OPTIONS' || isAllowedPath(req.path)) {
    return next();
  }

  if (!isNativeAndroidRequest(req)) {
    return next();
  }

  const minSupportedVersionCode = parseVersionCode(
    process.env.MIN_SUPPORTED_ANDROID_VERSION_CODE,
    0,
  );

  if (minSupportedVersionCode <= 0) {
    return next();
  }

  const versionCode = Number.parseInt(req.get('X-App-Version-Code'), 10);
  const hasValidVersionCode = Number.isFinite(versionCode) && versionCode >= 0;

  if (!hasValidVersionCode || versionCode < minSupportedVersionCode) {
    return res.status(426).json({
      success: false,
      code: 'UPDATE_REQUIRED',
      message: 'Please update GoodOne to continue.',
      minSupportedVersionCode,
      playStoreUrl: process.env.PLAY_STORE_URL || DEFAULT_PLAY_STORE_URL,
    });
  }

  return next();
};

module.exports = appVersionGate;
