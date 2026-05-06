import { Capacitor } from "@capacitor/core";

const ADMOB_BANNER_AD_UNIT_IDS = {
  android: "ca-app-pub-9859771616835832/2509706314",
  ios: "ca-app-pub-9859771616835832/9324413170",
};
const BANNER_BOTTOM_MARGIN_PX = 72;
const USE_TEST_ADS =
  String(process.env.REACT_APP_USE_ADMOB_TEST_ADS || "true").toLowerCase() !== "false";

let admobModulePromise = null;
let initializationPromise = null;
let isInitialized = false;

const isNativePlatform = () => Capacitor.isNativePlatform();

export const getAdMobBannerAdUnitId = () => {
  const platform = Capacitor.getPlatform();
  return ADMOB_BANNER_AD_UNIT_IDS[platform] || ADMOB_BANNER_AD_UNIT_IDS.android;
};

const logAdMobError = (action, error) => {
  console.warn(`[AdMob] ${action} failed`, error);
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

export const initializeAdMob = async () => {
  if (!isNativePlatform()) return false;
  if (isInitialized) return true;

  try {
    if (!initializationPromise) {
      initializationPromise = (async () => {
        const admobModule = await loadAdMobModule();
        if (!admobModule) return false;

        await admobModule.AdMob.initialize({
          initializeForTesting: USE_TEST_ADS,
        });
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

export const showAdMobBanner = async () => {
  if (!isNativePlatform()) return false;

  try {
    const admobModule = await loadAdMobModule();
    const initialized = await initializeAdMob();
    if (!admobModule || !initialized) return false;

    await admobModule.AdMob.showBanner({
      adId: getAdMobBannerAdUnitId(),
      adSize: admobModule.BannerAdSize.ADAPTIVE_BANNER,
      position: admobModule.BannerAdPosition.BOTTOM_CENTER,
      margin: BANNER_BOTTOM_MARGIN_PX,
      isTesting: USE_TEST_ADS,
    });
    return true;
  } catch (error) {
    logAdMobError("show banner", error);
    return false;
  }
};

export const hideAdMobBanner = async () => {
  if (!isNativePlatform()) return false;

  try {
    const admobModule = await loadAdMobModule();
    if (!admobModule) return false;

    await admobModule.AdMob.hideBanner();
    return true;
  } catch (error) {
    logAdMobError("hide banner", error);
    return false;
  }
};

export const removeAdMobBanner = async () => {
  if (!isNativePlatform()) return false;

  try {
    const admobModule = await loadAdMobModule();
    if (!admobModule) return false;

    await admobModule.AdMob.removeBanner();
    return true;
  } catch (error) {
    logAdMobError("remove banner", error);
    return false;
  }
};
