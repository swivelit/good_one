import {
  ADMOB_FORMATS,
  GOOGLE_DEMO_AD_UNIT_IDS,
  getAdMobAdUnitConfig,
  getAdMobPlatform,
  getAdMobRuntimeConfig,
  getAdMobTestDeviceIds,
  getMaskedAdMobFormatConfig,
  isAdMobNativePlatform,
  isUsingAdMobTestAds,
  maskAdMobAdUnitId,
} from "./admob/config";
import {
  INTERSTITIAL_PLACEMENTS,
  canShowAppOpenAd,
  canShowInterstitialAd,
  consumeVendorPostSuccessInterstitialFlag,
  getProductDetailViewCount,
  isProductDetailInterstitialMilestone,
  markVendorPostSuccessForInterstitial,
  recordInterstitialShown,
  trackProductDetailView,
} from "./admob/cooldowns";

export {
  ADMOB_FORMATS,
  GOOGLE_DEMO_AD_UNIT_IDS,
  getAdMobAdUnitConfig,
  getAdMobPlatform,
  getAdMobRuntimeConfig,
  getAdMobTestDeviceIds,
  getMaskedAdMobFormatConfig,
  isAdMobNativePlatform,
  isUsingAdMobTestAds,
  maskAdMobAdUnitId,
};

export {
  INTERSTITIAL_PLACEMENTS,
  canShowAppOpenAd,
  canShowInterstitialAd,
  consumeVendorPostSuccessInterstitialFlag,
  getProductDetailViewCount,
  isProductDetailInterstitialMilestone,
  markVendorPostSuccessForInterstitial,
  trackProductDetailView,
};

const BANNER_BOTTOM_MARGIN_PX = 0;
const MIN_ADAPTIVE_BANNER_HEIGHT_PX = 50;
const MAX_ADAPTIVE_BANNER_HEIGHT_PX = 90;
export const DEFAULT_ADMOB_BANNER_HEIGHT_PX = MIN_ADAPTIVE_BANNER_HEIGHT_PX;
const BANNER_LOAD_TIMEOUT_MS = 8000;
const BANNER_HEIGHT_CSS_VARIABLE = "--goodone-admob-banner-height";
const BANNER_LAYOUT_EVENT = "goodone:admob-banner-layout-change";
const MAX_DIAGNOSTIC_EVENTS = 40;

let admobModulePromise = null;
let initializationPromise = null;
let isInitialized = false;
let areAdMobListenersRegistered = false;
let bannerStatus = "idle";
let interstitialStatus = "idle";
let rewardedStatus = "idle";
let bannerLoadTimeout = null;
let lastKnownBannerHeightPx = DEFAULT_ADMOB_BANNER_HEIGHT_PX;
let lastMeasuredBannerHeightPx = 0;
let reservedBannerLayoutHeightPx = 0;
let diagnostics = {
  events: [],
  lastError: null,
};
const diagnosticSubscribers = new Set();

export const isNativePlatform = isAdMobNativePlatform;

const shouldWriteDebugLogs = () => (
  process.env.NODE_ENV !== "production" || isUsingAdMobTestAds()
);

const getErrorMessage = (error) => {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  return error.message || error.code || String(error);
};

const sanitizeDiagnosticValue = (value) => {
  if (value == null) return value;
  if (typeof value === "string") {
    return value.startsWith("ca-app-pub-") ? maskAdMobAdUnitId(value) : value;
  }
  if (Array.isArray(value)) return value.map(sanitizeDiagnosticValue);
  if (typeof value === "object") {
    return Object.entries(value).reduce((accumulator, [key, nestedValue]) => {
      accumulator[key] = sanitizeDiagnosticValue(nestedValue);
      return accumulator;
    }, {});
  }
  return value;
};

const emitDiagnosticsChange = () => {
  const snapshot = getAdMobDiagnostics();
  diagnosticSubscribers.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {
      // Diagnostics listeners are optional developer tooling.
    }
  });
};

const recordAdMobEvent = (level, message, details = {}) => {
  const event = {
    details: sanitizeDiagnosticValue(details),
    level,
    message,
    timestamp: new Date().toISOString(),
  };

  diagnostics = {
    ...diagnostics,
    events: [event, ...diagnostics.events].slice(0, MAX_DIAGNOSTIC_EVENTS),
    lastError: level === "error" ? event : diagnostics.lastError,
  };
  emitDiagnosticsChange();

  if (level === "error") {
    console.warn(`[AdMob] ${message}`, event.details);
    return;
  }

  if (shouldWriteDebugLogs()) {
    console.info(`[AdMob] ${message}`, event.details);
  }
};

const logAdMobError = (action, error, details = {}) => {
  recordAdMobEvent("error", `${action} failed`, {
    ...details,
    error: {
      code: error?.code,
      message: getErrorMessage(error),
      name: error?.name,
    },
  });
};

const logAdMobInfo = (message, details = {}) => {
  recordAdMobEvent("info", message, details);
};

const logAdMobSkip = (message, details = {}) => {
  recordAdMobEvent("skip", message, details);
};

export const getAdMobDiagnostics = () => ({
  events: diagnostics.events,
  lastError: diagnostics.lastError,
});

export const subscribeAdMobDiagnostics = (listener) => {
  diagnosticSubscribers.add(listener);
  listener(getAdMobDiagnostics());

  return () => {
    diagnosticSubscribers.delete(listener);
  };
};

export const getProductionAdMobBannerAdUnitId = () => (
  getAdMobAdUnitConfig(ADMOB_FORMATS.BANNER).useTestAds
    ? ""
    : getAdMobAdUnitConfig(ADMOB_FORMATS.BANNER).adId
);

export const getTestAdMobBannerAdUnitId = () => {
  const platform = getAdMobPlatform();
  return (
    GOOGLE_DEMO_AD_UNIT_IDS[platform]?.[ADMOB_FORMATS.BANNER] ||
    GOOGLE_DEMO_AD_UNIT_IDS.android[ADMOB_FORMATS.BANNER]
  );
};

export const getAdMobBannerAdUnitId = () => (
  getAdMobAdUnitConfig(ADMOB_FORMATS.BANNER).adId
);

export const getAdMobBannerStatus = () => bannerStatus;

export const getAdMobInterstitialStatus = () => interstitialStatus;

export const getAdMobRewardedStatus = () => rewardedStatus;

export const getAdMobBannerHeight = () => lastKnownBannerHeightPx;

export const isAdMobBannerRequestActive = () => (
  bannerStatus === "loading" || bannerStatus === "loaded"
);

const getViewportSize = () => {
  if (typeof window === "undefined") return { width: 0, height: 0 };

  const width = Math.max(
    Number(window.visualViewport?.width) || 0,
    Number(window.innerWidth) || 0,
    Number(window.screen?.width) || 0
  );
  const height = Math.max(
    Number(window.visualViewport?.height) || 0,
    Number(window.innerHeight) || 0,
    Number(window.screen?.height) || 0
  );

  return { width, height };
};

const getEstimatedBannerLayoutHeight = () => {
  if (typeof window === "undefined") return DEFAULT_ADMOB_BANNER_HEIGHT_PX;

  const { width, height } = getViewportSize();
  if (!width && !height) return DEFAULT_ADMOB_BANNER_HEIGHT_PX;

  const viewportWidthEstimate = width ? width / 8 : MAX_ADAPTIVE_BANNER_HEIGHT_PX;
  const viewportHeightCap = height ? height * 0.15 : MAX_ADAPTIVE_BANNER_HEIGHT_PX;
  return Math.ceil(Math.min(
    MAX_ADAPTIVE_BANNER_HEIGHT_PX,
    Math.max(
      MIN_ADAPTIVE_BANNER_HEIGHT_PX,
      Math.min(viewportWidthEstimate, viewportHeightCap)
    )
  ));
};

const normalizeBannerHeight = (height, fallbackHeight = getEstimatedBannerLayoutHeight()) => {
  const numericHeight = Number(height);
  if (!Number.isFinite(numericHeight) || numericHeight <= 0) {
    return fallbackHeight;
  }

  return Math.max(0, Math.ceil(numericHeight));
};

const emitAdMobBannerLayoutChange = (height) => {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent(BANNER_LAYOUT_EVENT, {
    detail: { height },
  }));
};

const setAdMobBannerLayoutHeight = (height) => {
  if (typeof document === "undefined") return;

  const normalizedHeight = Math.max(0, Math.ceil(Number(height) || 0));
  const didReservedHeightChange = normalizedHeight !== reservedBannerLayoutHeightPx;
  reservedBannerLayoutHeightPx = normalizedHeight;

  document.documentElement.style.setProperty(
    BANNER_HEIGHT_CSS_VARIABLE,
    `${normalizedHeight}px`
  );

  if (normalizedHeight > 0) {
    document.body?.classList?.add("goodone-admob-banner-active");
  } else {
    document.body?.classList?.remove("goodone-admob-banner-active");
  }

  if (didReservedHeightChange) {
    emitAdMobBannerLayoutChange(normalizedHeight);
  }
};

const reserveAdMobBannerLayoutSpace = (height = lastMeasuredBannerHeightPx || getEstimatedBannerLayoutHeight(), { measured = false } = {}) => {
  const fallbackHeight = lastMeasuredBannerHeightPx || getEstimatedBannerLayoutHeight();
  const normalizedHeight = normalizeBannerHeight(height, fallbackHeight);
  lastKnownBannerHeightPx = normalizedHeight;
  if (measured) {
    lastMeasuredBannerHeightPx = normalizedHeight;
  }
  setAdMobBannerLayoutHeight(normalizedHeight);
};

const releaseAdMobBannerLayoutSpace = () => {
  setAdMobBannerLayoutHeight(0);
};

const clearBannerLoadTimeout = () => {
  if (bannerLoadTimeout) {
    clearTimeout(bannerLoadTimeout);
    bannerLoadTimeout = null;
  }
};

const setBannerStatus = (nextStatus) => {
  bannerStatus = nextStatus;
};

const markBannerLoaded = (source, data = {}) => {
  clearBannerLoadTimeout();
  const measuredHeight = Number(data?.height) > 0 ? data.height : null;
  reserveAdMobBannerLayoutSpace(
    measuredHeight || lastMeasuredBannerHeightPx || getEstimatedBannerLayoutHeight(),
    { measured: Boolean(measuredHeight) }
  );
  setBannerStatus("loaded");
  logAdMobInfo("banner loaded", { source, ...data });
};

const markBannerFailed = (source, error) => {
  clearBannerLoadTimeout();
  setBannerStatus("failed");
  releaseAdMobBannerLayoutSpace();
  logAdMobError(source, error);
};

const startBannerLoadTimeout = () => {
  clearBannerLoadTimeout();
  bannerLoadTimeout = setTimeout(() => {
    if (bannerStatus === "loading") {
      setBannerStatus("failed");
      releaseAdMobBannerLayoutSpace();
      logAdMobError("banner load timeout", {
        message: "No Loaded/FailedToLoad event was received before timeout.",
        timeoutMs: BANNER_LOAD_TIMEOUT_MS,
      });
    }
  }, BANNER_LOAD_TIMEOUT_MS);
};

export const syncAdMobBannerLayoutForViewport = () => {
  if (!isAdMobBannerRequestActive()) {
    return reservedBannerLayoutHeightPx;
  }

  reserveAdMobBannerLayoutSpace(
    lastMeasuredBannerHeightPx || getEstimatedBannerLayoutHeight()
  );
  return reservedBannerLayoutHeightPx;
};

const loadAdMobModule = async () => {
  if (!isAdMobNativePlatform()) {
    logAdMobSkip("native AdMob plugin skipped on non-native platform", {
      platform: getAdMobPlatform(),
    });
    return null;
  }

  if (!admobModulePromise) {
    admobModulePromise = import("@capacitor-community/admob");
  }

  try {
    return await admobModulePromise;
  } catch (error) {
    admobModulePromise = null;
    throw error;
  }
};

const addAdMobListener = (admobModule, eventName, callback) => {
  const addListener = admobModule?.AdMob?.addListener?.bind(admobModule.AdMob);
  if (!addListener || !eventName) return;

  try {
    const handle = addListener(eventName, callback);
    if (handle?.catch) {
      handle.catch((error) => logAdMobError("register listener", error, { eventName }));
    }
  } catch (error) {
    logAdMobError("register listener", error, { eventName });
  }
};

const registerAdMobListeners = (admobModule) => {
  if (areAdMobListenersRegistered) return;

  const {
    BannerAdPluginEvents,
    InterstitialAdPluginEvents,
    RewardAdPluginEvents,
  } = admobModule || {};

  addAdMobListener(admobModule, BannerAdPluginEvents?.Loaded, () => {
    markBannerLoaded("Loaded event");
  });

  addAdMobListener(admobModule, BannerAdPluginEvents?.FailedToLoad, (error) => {
    markBannerFailed("banner load", error);
  });

  addAdMobListener(admobModule, BannerAdPluginEvents?.SizeChanged, (size) => {
    logAdMobInfo("banner size changed", size);
    if (Number(size?.height) > 0 || Number(size?.width) > 0) {
      markBannerLoaded("SizeChanged event", size);
    }
  });

  addAdMobListener(admobModule, BannerAdPluginEvents?.Opened, () => {
    logAdMobInfo("banner opened");
  });

  addAdMobListener(admobModule, BannerAdPluginEvents?.Closed, () => {
    logAdMobInfo("banner closed");
  });

  addAdMobListener(admobModule, BannerAdPluginEvents?.AdImpression, () => {
    logAdMobInfo("banner impression");
  });

  addAdMobListener(admobModule, InterstitialAdPluginEvents?.Loaded, (info) => {
    interstitialStatus = "loaded";
    logAdMobInfo("interstitial loaded", info);
  });

  addAdMobListener(admobModule, InterstitialAdPluginEvents?.FailedToLoad, (error) => {
    interstitialStatus = "failed";
    logAdMobError("interstitial load", error);
  });

  addAdMobListener(admobModule, InterstitialAdPluginEvents?.Showed, () => {
    interstitialStatus = "shown";
    logAdMobInfo("interstitial shown");
  });

  addAdMobListener(admobModule, InterstitialAdPluginEvents?.Dismissed, () => {
    interstitialStatus = "dismissed";
    logAdMobInfo("interstitial dismissed");
  });

  addAdMobListener(admobModule, InterstitialAdPluginEvents?.FailedToShow, (error) => {
    interstitialStatus = "failed";
    logAdMobError("interstitial show", error);
  });

  addAdMobListener(admobModule, RewardAdPluginEvents?.Loaded, (info) => {
    rewardedStatus = "loaded";
    logAdMobInfo("rewarded loaded", info);
  });

  addAdMobListener(admobModule, RewardAdPluginEvents?.FailedToLoad, (error) => {
    rewardedStatus = "failed";
    logAdMobError("rewarded load", error);
  });

  addAdMobListener(admobModule, RewardAdPluginEvents?.Showed, () => {
    rewardedStatus = "shown";
    logAdMobInfo("rewarded shown");
  });

  addAdMobListener(admobModule, RewardAdPluginEvents?.Dismissed, () => {
    rewardedStatus = "dismissed";
    logAdMobInfo("rewarded dismissed");
  });

  addAdMobListener(admobModule, RewardAdPluginEvents?.FailedToShow, (error) => {
    rewardedStatus = "failed";
    logAdMobError("rewarded show", error);
  });

  addAdMobListener(admobModule, RewardAdPluginEvents?.Rewarded, (reward) => {
    logAdMobInfo("rewarded callback received", reward);
  });

  areAdMobListenersRegistered = true;
};

const prepareAdMobConsent = async (admobModule) => {
  const { AdMob, AdmobConsentStatus } = admobModule || {};
  if (!AdMob?.requestConsentInfo) return true;

  const testDeviceIds = getAdMobTestDeviceIds();
  const consentOptions = testDeviceIds.length
    ? { testDeviceIdentifiers: testDeviceIds }
    : undefined;

  try {
    const consentInfo = await AdMob.requestConsentInfo(consentOptions);
    logAdMobInfo("consent info checked", {
      canRequestAds: consentInfo?.canRequestAds,
      isConsentFormAvailable: consentInfo?.isConsentFormAvailable,
      status: consentInfo?.status,
      testDeviceCount: testDeviceIds.length,
    });

    if (
      consentInfo?.isConsentFormAvailable &&
      consentInfo?.status === AdmobConsentStatus?.REQUIRED &&
      AdMob.showConsentForm
    ) {
      const updatedConsentInfo = await AdMob.showConsentForm();
      return updatedConsentInfo?.canRequestAds !== false;
    }

    return consentInfo?.canRequestAds !== false;
  } catch (error) {
    logAdMobError("consent check", error);
    return true;
  }
};

const getInitializeOptions = () => {
  const testDeviceIds = getAdMobTestDeviceIds();
  const options = {
    initializeForTesting: isUsingAdMobTestAds(),
  };

  if (isUsingAdMobTestAds() && testDeviceIds.length) {
    options.testingDevices = testDeviceIds;
  }

  return options;
};

export const initializeAdMob = async () => {
  if (!isAdMobNativePlatform()) {
    logAdMobSkip("initialize skipped on non-native platform", {
      platform: getAdMobPlatform(),
    });
    return false;
  }
  if (isInitialized) return true;

  try {
    if (!initializationPromise) {
      initializationPromise = (async () => {
        const admobModule = await loadAdMobModule();
        if (!admobModule?.AdMob?.initialize) return false;

        registerAdMobListeners(admobModule);

        const initializeOptions = getInitializeOptions();
        logAdMobInfo("initialize requested", {
          initializeForTesting: initializeOptions.initializeForTesting,
          testDeviceCount: initializeOptions.testingDevices?.length || 0,
        });

        await admobModule.AdMob.initialize(initializeOptions);

        const canRequestAds = await prepareAdMobConsent(admobModule);
        if (!canRequestAds) {
          logAdMobSkip("consent not ready; ad requests skipped");
          return false;
        }

        isInitialized = true;
        logAdMobInfo("initialize complete", {
          platform: getAdMobPlatform(),
          useTestAds: isUsingAdMobTestAds(),
        });
        return true;
      })();
    }

    return await initializationPromise;
  } catch (error) {
    initializationPromise = null;
    isInitialized = false;
    logAdMobError("initialize", error);
    return false;
  }
};

const getConfiguredAdUnit = (format) => {
  const config = getAdMobAdUnitConfig(format);
  if (!config.configured) {
    logAdMobSkip(`${format} skipped because no ad unit is configured`, {
      format,
      platform: config.platform,
      source: config.source,
      useTestAds: config.useTestAds,
    });
    return null;
  }

  return config;
};

export const showAdMobBanner = async ({ force = false } = {}) => {
  if (!isAdMobNativePlatform()) {
    setBannerStatus("skipped");
    releaseAdMobBannerLayoutSpace();
    logAdMobSkip("banner skipped on non-native platform", {
      platform: getAdMobPlatform(),
    });
    return false;
  }
  if (!force && isAdMobBannerRequestActive()) return true;

  const config = getConfiguredAdUnit(ADMOB_FORMATS.BANNER);
  if (!config) {
    setBannerStatus("skipped");
    releaseAdMobBannerLayoutSpace();
    return false;
  }

  try {
    const admobModule = await loadAdMobModule();
    const initialized = await initializeAdMob();
    if (!admobModule || !initialized) {
      setBannerStatus("failed");
      releaseAdMobBannerLayoutSpace();
      return false;
    }

    setBannerStatus("loading");
    reserveAdMobBannerLayoutSpace();
    startBannerLoadTimeout();
    logAdMobInfo("banner request", {
      adId: config.adId,
      source: config.source,
      useTestAds: config.useTestAds,
    });

    await admobModule.AdMob.showBanner({
      adId: config.adId,
      adSize: admobModule.BannerAdSize?.ADAPTIVE_BANNER || admobModule.BannerAdSize?.BANNER,
      position: admobModule.BannerAdPosition?.BOTTOM_CENTER,
      margin: BANNER_BOTTOM_MARGIN_PX,
      isTesting: config.useTestAds,
    });
    return true;
  } catch (error) {
    markBannerFailed("show banner", error);
    return false;
  }
};

export const hideAdMobBanner = async () => {
  if (!isAdMobNativePlatform()) {
    logAdMobSkip("hide banner skipped on non-native platform", {
      platform: getAdMobPlatform(),
    });
    return false;
  }

  try {
    const admobModule = await loadAdMobModule();
    if (!admobModule?.AdMob?.hideBanner) return false;

    await admobModule.AdMob.hideBanner();
    setBannerStatus("hidden");
    releaseAdMobBannerLayoutSpace();
    logAdMobInfo("banner hidden");
    return true;
  } catch (error) {
    logAdMobError("hide banner", error);
    return false;
  }
};

export const removeAdMobBanner = async () => {
  if (!isAdMobNativePlatform()) {
    setBannerStatus("idle");
    releaseAdMobBannerLayoutSpace();
    logAdMobSkip("remove banner skipped on non-native platform", {
      platform: getAdMobPlatform(),
    });
    return false;
  }

  try {
    clearBannerLoadTimeout();
    const admobModule = await loadAdMobModule();
    if (!admobModule?.AdMob?.removeBanner) {
      setBannerStatus("idle");
      releaseAdMobBannerLayoutSpace();
      return false;
    }

    await admobModule.AdMob.removeBanner();
    setBannerStatus("idle");
    releaseAdMobBannerLayoutSpace();
    logAdMobInfo("banner removed");
    return true;
  } catch (error) {
    setBannerStatus("failed");
    releaseAdMobBannerLayoutSpace();
    logAdMobError("remove banner", error);
    return false;
  }
};

export const loadAdMobInterstitial = async () => {
  if (!isAdMobNativePlatform()) {
    interstitialStatus = "skipped";
    logAdMobSkip("interstitial skipped on non-native platform", {
      platform: getAdMobPlatform(),
    });
    return false;
  }

  const config = getConfiguredAdUnit(ADMOB_FORMATS.INTERSTITIAL);
  if (!config) {
    interstitialStatus = "skipped";
    return false;
  }

  try {
    const admobModule = await loadAdMobModule();
    const initialized = await initializeAdMob();
    if (!admobModule?.AdMob?.prepareInterstitial || !initialized) {
      interstitialStatus = "unsupported";
      logAdMobSkip("interstitial skipped because prepareInterstitial is unavailable");
      return false;
    }

    interstitialStatus = "loading";
    logAdMobInfo("interstitial load requested", {
      adId: config.adId,
      source: config.source,
      useTestAds: config.useTestAds,
    });
    await admobModule.AdMob.prepareInterstitial({
      adId: config.adId,
      isTesting: config.useTestAds,
    });
    interstitialStatus = "loaded";
    return true;
  } catch (error) {
    interstitialStatus = "failed";
    logAdMobError("load interstitial", error);
    return false;
  }
};

export const showAdMobInterstitial = async ({
  currentPath = "",
  placement = INTERSTITIAL_PLACEMENTS.PRODUCT_DETAIL_RETURN,
} = {}) => {
  const gate = canShowInterstitialAd({ currentPath, placement });
  if (!gate.allowed) {
    logAdMobSkip("interstitial blocked by placement policy", {
      currentPath,
      placement,
      reason: gate.reason,
    });
    return false;
  }

  try {
    const admobModule = await loadAdMobModule();
    const loaded = await loadAdMobInterstitial();
    if (!loaded || !admobModule?.AdMob?.showInterstitial) return false;

    logAdMobInfo("interstitial show requested", { currentPath, placement });
    await admobModule.AdMob.showInterstitial();
    recordInterstitialShown();
    interstitialStatus = "shown";
    return true;
  } catch (error) {
    interstitialStatus = "failed";
    logAdMobError("show interstitial", error, { currentPath, placement });
    return false;
  }
};

export const maybeShowAdMobInterstitial = showAdMobInterstitial;

export const maybeShowProductDetailReturnInterstitial = async (currentPath = "") => {
  if (!isProductDetailInterstitialMilestone()) {
    logAdMobSkip("product detail return interstitial milestone not reached", {
      productDetailViewCount: getProductDetailViewCount(),
    });
    return false;
  }

  return showAdMobInterstitial({
    currentPath,
    placement: INTERSTITIAL_PLACEMENTS.PRODUCT_DETAIL_RETURN,
  });
};

export const maybeShowVendorPostSuccessInterstitial = async (currentPath = "/dashboard") => (
  showAdMobInterstitial({
    currentPath,
    placement: INTERSTITIAL_PLACEMENTS.VENDOR_POST_SUCCESS,
  })
);

export const isAdMobAppOpenSupported = () => false;

export const maybeShowAdMobAppOpenAd = async ({
  currentPath = "",
  reason = "resume",
} = {}) => {
  const gate = canShowAppOpenAd({ currentPath });
  if (!gate.allowed) {
    logAdMobSkip("app-open blocked by placement policy", {
      currentPath,
      reason: gate.reason,
      trigger: reason,
    });
    return false;
  }

  logAdMobSkip("app-open skipped because @capacitor-community/admob does not expose app-open ads", {
    currentPath,
    trigger: reason,
  });
  return false;
};

export const loadAdMobRewardedAd = async () => {
  if (!isAdMobNativePlatform()) {
    rewardedStatus = "skipped";
    logAdMobSkip("rewarded skipped on non-native platform", {
      platform: getAdMobPlatform(),
    });
    return false;
  }

  const config = getConfiguredAdUnit(ADMOB_FORMATS.REWARDED);
  if (!config) {
    rewardedStatus = "skipped";
    return false;
  }

  try {
    const admobModule = await loadAdMobModule();
    const initialized = await initializeAdMob();
    if (!admobModule?.AdMob?.prepareRewardVideoAd || !initialized) {
      rewardedStatus = "unsupported";
      logAdMobSkip("rewarded skipped because prepareRewardVideoAd is unavailable");
      return false;
    }

    rewardedStatus = "loading";
    logAdMobInfo("rewarded load requested", {
      adId: config.adId,
      source: config.source,
      useTestAds: config.useTestAds,
    });
    await admobModule.AdMob.prepareRewardVideoAd({
      adId: config.adId,
      isTesting: config.useTestAds,
    });
    rewardedStatus = "loaded";
    return true;
  } catch (error) {
    rewardedStatus = "failed";
    logAdMobError("load rewarded", error);
    return false;
  }
};

export const showAdMobRewardedAd = async ({
  onReward,
  rewardContext = "unspecified",
} = {}) => {
  if (typeof onReward !== "function") {
    logAdMobSkip("rewarded skipped because no explicit reward callback was supplied", {
      rewardContext,
    });
    return false;
  }

  try {
    const admobModule = await loadAdMobModule();
    const loaded = await loadAdMobRewardedAd();
    if (!loaded || !admobModule?.AdMob?.showRewardVideoAd) return false;

    logAdMobInfo("rewarded show requested", { rewardContext });
    const reward = await admobModule.AdMob.showRewardVideoAd();
    if (reward) {
      onReward(reward);
    }
    rewardedStatus = "shown";
    return true;
  } catch (error) {
    rewardedStatus = "failed";
    logAdMobError("show rewarded", error, { rewardContext });
    return false;
  }
};

export const getAdMobFeatureSupport = async () => {
  if (!isAdMobNativePlatform()) {
    return {
      adInspector: false,
      appOpen: false,
      banner: false,
      interstitial: false,
      rewarded: false,
    };
  }

  try {
    const admobModule = await loadAdMobModule();
    const AdMob = admobModule?.AdMob || {};
    return {
      adInspector: Boolean(AdMob.openAdInspector || AdMob.launchAdInspector),
      appOpen: false,
      banner: Boolean(AdMob.showBanner),
      interstitial: Boolean(AdMob.prepareInterstitial && AdMob.showInterstitial),
      rewarded: Boolean(AdMob.prepareRewardVideoAd && AdMob.showRewardVideoAd),
    };
  } catch (error) {
    logAdMobError("feature support check", error);
    return {
      adInspector: false,
      appOpen: false,
      banner: false,
      interstitial: false,
      rewarded: false,
    };
  }
};

export const openAdMobAdInspector = async () => {
  if (!isAdMobNativePlatform()) {
    logAdMobSkip("Ad Inspector skipped on non-native platform", {
      platform: getAdMobPlatform(),
    });
    return false;
  }

  try {
    const admobModule = await loadAdMobModule();
    const inspectorLauncher = (
      admobModule?.AdMob?.openAdInspector ||
      admobModule?.AdMob?.launchAdInspector
    );

    if (!inspectorLauncher) {
      logAdMobSkip("Ad Inspector unavailable in installed AdMob plugin");
      return false;
    }

    const initialized = await initializeAdMob();
    if (!initialized) return false;

    await inspectorLauncher.call(admobModule.AdMob);
    logAdMobInfo("Ad Inspector launched");
    return true;
  } catch (error) {
    logAdMobError("launch Ad Inspector", error);
    return false;
  }
};
