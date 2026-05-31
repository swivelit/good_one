export const INTERSTITIAL_COOLDOWN_MS = 3 * 60 * 1000;
export const INTERSTITIAL_DAILY_CAP = 3;
export const APP_OPEN_COOLDOWN_MS = 4 * 60 * 60 * 1000;

const INTERSTITIAL_STATE_KEY = "goodone_admob_interstitial_state_v1";
const APP_OPEN_STATE_KEY = "goodone_admob_app_open_state_v1";
const PRODUCT_DETAIL_VIEW_COUNT_KEY = "goodone_admob_product_detail_views_v1";
const VENDOR_POST_SUCCESS_KEY = "goodone_admob_vendor_post_success_v1";

const SENSITIVE_ROUTE_PREFIXES = [
  "/login",
  "/forgot-password",
  "/register",
  "/dashboard/add-product",
  "/chat",
];

export const INTERSTITIAL_PLACEMENTS = {
  PRODUCT_DETAIL_RETURN: "product-detail-return",
  VENDOR_POST_SUCCESS: "vendor-post-success",
};

const canUseStorage = () => typeof window !== "undefined" && Boolean(window.localStorage);

const getStorage = () => {
  if (!canUseStorage()) return null;
  return window.localStorage;
};

const getTodayKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

const readJson = (key, fallback) => {
  try {
    const storage = getStorage();
    if (!storage) return fallback;

    const parsed = JSON.parse(storage.getItem(key));
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  try {
    const storage = getStorage();
    if (!storage) return;
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can fail in private mode. Ads should never block the app flow.
  }
};

const readNumber = (key, fallback = 0) => {
  try {
    const storage = getStorage();
    if (!storage) return fallback;

    const value = Number(storage.getItem(key));
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
};

const writeString = (key, value) => {
  try {
    const storage = getStorage();
    if (!storage) return;
    storage.setItem(key, String(value));
  } catch {
    // Ignore storage failures.
  }
};

const removeItem = (key) => {
  try {
    getStorage()?.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
};

export const isAdMobSensitiveRoute = (pathname = "") => {
  const normalizedPath = String(pathname || "");
  return SENSITIVE_ROUTE_PREFIXES.some((prefix) => (
    normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
  ));
};

export const getInterstitialState = (now = Date.now()) => {
  const today = getTodayKey(now);
  const state = readJson(INTERSTITIAL_STATE_KEY, {});

  return {
    day: today,
    dailyCount: state.day === today ? Number(state.dailyCount) || 0 : 0,
    lastShownAt: Number(state.lastShownAt) || 0,
  };
};

export const canShowInterstitialAd = ({
  currentPath = "",
  now = Date.now(),
  placement,
} = {}) => {
  if (!Object.values(INTERSTITIAL_PLACEMENTS).includes(placement)) {
    return {
      allowed: false,
      reason: placement === "app-launch" ? "blocked-app-launch" : "unknown-placement",
    };
  }

  if (isAdMobSensitiveRoute(currentPath)) {
    return { allowed: false, reason: "sensitive-route" };
  }

  const state = getInterstitialState(now);
  if (state.dailyCount >= INTERSTITIAL_DAILY_CAP) {
    return { allowed: false, reason: "daily-cap" };
  }

  if (state.lastShownAt && now - state.lastShownAt < INTERSTITIAL_COOLDOWN_MS) {
    return { allowed: false, reason: "cooldown" };
  }

  return { allowed: true, reason: "allowed" };
};

export const recordInterstitialShown = (now = Date.now()) => {
  const state = getInterstitialState(now);
  const nextState = {
    day: getTodayKey(now),
    dailyCount: state.dailyCount + 1,
    lastShownAt: now,
  };

  writeJson(INTERSTITIAL_STATE_KEY, nextState);
  return nextState;
};

export const resetInterstitialState = () => {
  removeItem(INTERSTITIAL_STATE_KEY);
};

export const trackProductDetailView = () => {
  const nextCount = readNumber(PRODUCT_DETAIL_VIEW_COUNT_KEY, 0) + 1;
  writeString(PRODUCT_DETAIL_VIEW_COUNT_KEY, nextCount);
  return nextCount;
};

export const getProductDetailViewCount = () => (
  readNumber(PRODUCT_DETAIL_VIEW_COUNT_KEY, 0)
);

export const isProductDetailInterstitialMilestone = (count = getProductDetailViewCount()) => (
  count > 0 && count % 5 === 0
);

export const markVendorPostSuccessForInterstitial = () => {
  writeString(VENDOR_POST_SUCCESS_KEY, "true");
};

export const consumeVendorPostSuccessInterstitialFlag = () => {
  try {
    const storage = getStorage();
    if (!storage) return false;

    const isPending = storage.getItem(VENDOR_POST_SUCCESS_KEY) === "true";
    storage.removeItem(VENDOR_POST_SUCCESS_KEY);
    return isPending;
  } catch {
    return false;
  }
};

export const getAppOpenState = () => (
  readJson(APP_OPEN_STATE_KEY, { lastShownAt: 0 })
);

export const canShowAppOpenAd = ({
  currentPath = "",
  now = Date.now(),
} = {}) => {
  if (isAdMobSensitiveRoute(currentPath)) {
    return { allowed: false, reason: "sensitive-route" };
  }

  const state = getAppOpenState();
  const lastShownAt = Number(state.lastShownAt) || 0;
  if (lastShownAt && now - lastShownAt < APP_OPEN_COOLDOWN_MS) {
    return { allowed: false, reason: "cooldown" };
  }

  return { allowed: true, reason: "allowed" };
};

export const recordAppOpenShown = (now = Date.now()) => {
  const nextState = { lastShownAt: now };
  writeJson(APP_OPEN_STATE_KEY, nextState);
  return nextState;
};

export const resetAppOpenState = () => {
  removeItem(APP_OPEN_STATE_KEY);
};
