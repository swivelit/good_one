import { Capacitor } from "@capacitor/core";

const PRODUCTION_BANNER_AD_UNIT_IDS = {
  android: "ca-app-pub-9859771616835832/2509706314",
  ios: "ca-app-pub-9859771616835832/9324413170",
};

const GOOGLE_DEMO_BANNER_AD_UNIT_IDS = {
  android: "ca-app-pub-3940256099942544/6300978111",
  ios: "ca-app-pub-3940256099942544/2934735716",
};

const BANNER_BOTTOM_MARGIN_PX = 0;
const MIN_ADAPTIVE_BANNER_HEIGHT_PX = 50;
const MAX_ADAPTIVE_BANNER_HEIGHT_PX = 90;
export const DEFAULT_ADMOB_BANNER_HEIGHT_PX = MIN_ADAPTIVE_BANNER_HEIGHT_PX;
const BANNER_LOAD_TIMEOUT_MS = 8000;
const BANNER_HEIGHT_CSS_VARIABLE = "--goodone-admob-banner-height";
const BANNER_LAYOUT_EVENT = "goodone:admob-banner-layout-change";
const USE_TEST_ADS =
  String(process.env.REACT_APP_USE_ADMOB_TEST_ADS || "true").toLowerCase() !== "false";

let admobModulePromise = null;
let initializationPromise = null;
let isInitialized = false;
let areBannerListenersRegistered = false;
let bannerStatus = "idle";
let bannerLoadTimeout = null;
let lastKnownBannerHeightPx = DEFAULT_ADMOB_BANNER_HEIGHT_PX;
let lastMeasuredBannerHeightPx = 0;
let reservedBannerLayoutHeightPx = 0;

const isNativePlatform = () => Capacitor.isNativePlatform();

export const isUsingAdMobTestAds = () => USE_TEST_ADS;

export const getProductionAdMobBannerAdUnitId = () => {
  const platform = Capacitor.getPlatform();
  return PRODUCTION_BANNER_AD_UNIT_IDS[platform] || PRODUCTION_BANNER_AD_UNIT_IDS.android;
};

export const getTestAdMobBannerAdUnitId = () => {
  const platform = Capacitor.getPlatform();
  return GOOGLE_DEMO_BANNER_AD_UNIT_IDS[platform] || GOOGLE_DEMO_BANNER_AD_UNIT_IDS.android;
};

export const getAdMobBannerAdUnitId = () => (
  USE_TEST_ADS ? getTestAdMobBannerAdUnitId() : getProductionAdMobBannerAdUnitId()
);

export const getAdMobBannerStatus = () => bannerStatus;

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

const logAdMobError = (action, error) => {
  console.warn(`[AdMob] ${action} failed`, error);
};

const logAdMobInfo = (message, data) => {
  if (process.env.NODE_ENV !== "production" || USE_TEST_ADS) {
    console.info(`[AdMob] ${message}`, data || "");
  }
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
  logAdMobInfo(`banner loaded via ${source}`, data);
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
        timeoutMs: BANNER_LOAD_TIMEOUT_MS,
        message: "No AdMob Loaded/FailedToLoad event was received. The app will retry the banner request.",
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
  if (!isNativePlatform()) return null;

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

const registerBannerListeners = (admobModule) => {
  if (areBannerListenersRegistered || !admobModule?.BannerAdPluginEvents) return;

  const { AdMob, BannerAdPluginEvents } = admobModule;
  const addListener = AdMob?.addListener?.bind(AdMob);
  if (!addListener) return;

  addListener(BannerAdPluginEvents.Loaded, () => {
    markBannerLoaded("Loaded event");
  });

  addListener(BannerAdPluginEvents.FailedToLoad, (error) => {
    markBannerFailed("banner load", error);
  });

  addListener(BannerAdPluginEvents.SizeChanged, (size) => {
    logAdMobInfo("banner size changed", size);
    if (Number(size?.height) > 0 || Number(size?.width) > 0) {
      markBannerLoaded("SizeChanged event", size);
    }
  });

  areBannerListenersRegistered = true;
};

const prepareAdMobConsent = async (admobModule) => {
  const { AdMob, AdmobConsentStatus } = admobModule;
  if (!AdMob?.requestConsentInfo) return true;

  try {
    const consentInfo = await AdMob.requestConsentInfo();
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

export const initializeAdMob = async () => {
  if (!isNativePlatform()) return false;
  if (isInitialized) return true;

  try {
    if (!initializationPromise) {
      initializationPromise = (async () => {
        const admobModule = await loadAdMobModule();
        if (!admobModule) return false;

        registerBannerListeners(admobModule);

        await admobModule.AdMob.initialize({
          initializeForTesting: USE_TEST_ADS,
        });

        const canRequestAds = await prepareAdMobConsent(admobModule);
        if (!canRequestAds) {
          logAdMobInfo("consent not ready; banner request skipped");
          return false;
        }

        isInitialized = true;
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

export const showAdMobBanner = async ({ force = false } = {}) => {
  if (!isNativePlatform()) return false;
  if (!force && isAdMobBannerRequestActive()) return true;

  try {
    const admobModule = await loadAdMobModule();
    const initialized = await initializeAdMob();
    if (!admobModule || !initialized) {
      setBannerStatus("failed");
      releaseAdMobBannerLayoutSpace();
      return false;
    }

    const adId = getAdMobBannerAdUnitId();
    setBannerStatus("loading");
    reserveAdMobBannerLayoutSpace();
    startBannerLoadTimeout();
    logAdMobInfo(`${USE_TEST_ADS ? "test" : "live"} banner request`, { adId });

    await admobModule.AdMob.showBanner({
      adId,
      adSize: admobModule.BannerAdSize.ADAPTIVE_BANNER || admobModule.BannerAdSize.BANNER,
      position: admobModule.BannerAdPosition.BOTTOM_CENTER,
      margin: BANNER_BOTTOM_MARGIN_PX,
      isTesting: USE_TEST_ADS,
    });
    return true;
  } catch (error) {
    markBannerFailed("show banner", error);
    return false;
  }
};

export const hideAdMobBanner = async () => {
  if (!isNativePlatform()) return false;

  try {
    const admobModule = await loadAdMobModule();
    if (!admobModule) return false;

    await admobModule.AdMob.hideBanner();
    setBannerStatus("hidden");
    releaseAdMobBannerLayoutSpace();
    return true;
  } catch (error) {
    logAdMobError("hide banner", error);
    return false;
  }
};

export const removeAdMobBanner = async () => {
  if (!isNativePlatform()) return false;

  try {
    clearBannerLoadTimeout();
    const admobModule = await loadAdMobModule();
    if (!admobModule) {
      setBannerStatus("idle");
      releaseAdMobBannerLayoutSpace();
      return false;
    }

    await admobModule.AdMob.removeBanner();
    setBannerStatus("idle");
    releaseAdMobBannerLayoutSpace();
    return true;
  } catch (error) {
    setBannerStatus("failed");
    releaseAdMobBannerLayoutSpace();
    logAdMobError("remove banner", error);
    return false;
  }
};
