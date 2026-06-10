import { Capacitor } from "@capacitor/core";

export const ADMOB_FORMATS = {
  BANNER: "banner",
  APP_OPEN: "appOpen",
  INTERSTITIAL: "interstitial",
  REWARDED: "rewarded",
  NATIVE: "native",
};

export const GOOGLE_DEMO_AD_UNIT_IDS = {
  android: {
    [ADMOB_FORMATS.BANNER]: "ca-app-pub-3940256099942544/6300978111",
    [ADMOB_FORMATS.APP_OPEN]: "ca-app-pub-3940256099942544/9257395921",
    [ADMOB_FORMATS.INTERSTITIAL]: "ca-app-pub-3940256099942544/1033173712",
    [ADMOB_FORMATS.REWARDED]: "ca-app-pub-3940256099942544/5224354917",
    // Google's official "Native advanced" test unit.
    [ADMOB_FORMATS.NATIVE]: "ca-app-pub-3940256099942544/2247696110",
  },
  ios: {
    [ADMOB_FORMATS.BANNER]: "ca-app-pub-3940256099942544/2934735716",
    [ADMOB_FORMATS.APP_OPEN]: "ca-app-pub-3940256099942544/5575463023",
    [ADMOB_FORMATS.INTERSTITIAL]: "ca-app-pub-3940256099942544/4411468910",
    [ADMOB_FORMATS.REWARDED]: "ca-app-pub-3940256099942544/1712485313",
    // Google's official "Native advanced" test unit.
    [ADMOB_FORMATS.NATIVE]: "ca-app-pub-3940256099942544/3986624511",
  },
};

const PRODUCTION_AD_UNIT_ENV = {
  android: {
    [ADMOB_FORMATS.BANNER]: "REACT_APP_ADMOB_ANDROID_BANNER_ID",
    [ADMOB_FORMATS.APP_OPEN]: "REACT_APP_ADMOB_ANDROID_APP_OPEN_ID",
    [ADMOB_FORMATS.INTERSTITIAL]: "REACT_APP_ADMOB_ANDROID_INTERSTITIAL_ID",
    [ADMOB_FORMATS.REWARDED]: "REACT_APP_ADMOB_ANDROID_REWARDED_ID",
    [ADMOB_FORMATS.NATIVE]: "REACT_APP_ADMOB_ANDROID_NATIVE_ID",
  },
  ios: {
    [ADMOB_FORMATS.BANNER]: "REACT_APP_ADMOB_IOS_BANNER_ID",
    [ADMOB_FORMATS.APP_OPEN]: "REACT_APP_ADMOB_IOS_APP_OPEN_ID",
    [ADMOB_FORMATS.INTERSTITIAL]: "REACT_APP_ADMOB_IOS_INTERSTITIAL_ID",
    [ADMOB_FORMATS.REWARDED]: "REACT_APP_ADMOB_IOS_REWARDED_ID",
    [ADMOB_FORMATS.NATIVE]: "REACT_APP_ADMOB_IOS_NATIVE_ID",
  },
};

export const getAdMobPlatform = () => {
  try {
    return Capacitor?.getPlatform?.() || "web";
  } catch {
    return "web";
  }
};

export const isAdMobNativePlatform = () => {
  try {
    return Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
};

export const isAdMobProductionModeRequested = () => (
  process.env.REACT_APP_USE_ADMOB_TEST_ADS === "false"
);

export const isUsingAdMobTestAds = () => {
  if (process.env.NODE_ENV !== "production") return true;
  return !isAdMobProductionModeRequested();
};

export const getAdMobTestDeviceIds = () => {
  if (!isUsingAdMobTestAds()) return [];

  return String(process.env.REACT_APP_ADMOB_TEST_DEVICE_IDS || "")
    .split(",")
    .map((deviceId) => deviceId.trim())
    .filter(Boolean);
};

const getProductionAdUnitId = (platform, format) => {
  const envName = PRODUCTION_AD_UNIT_ENV[platform]?.[format];
  return envName ? String(process.env[envName] || "").trim() : "";
};

const getDemoAdUnitId = (platform, format) => (
  GOOGLE_DEMO_AD_UNIT_IDS[platform]?.[format] ||
  GOOGLE_DEMO_AD_UNIT_IDS.android[format] ||
  ""
);

export const getAdMobAdUnitConfig = (format, platform = getAdMobPlatform()) => {
  const useTestAds = isUsingAdMobTestAds();
  const adId = useTestAds
    ? getDemoAdUnitId(platform, format)
    : getProductionAdUnitId(platform, format);

  return {
    adId,
    configured: Boolean(adId),
    format,
    platform,
    source: useTestAds ? "google-demo" : "env-production",
    useTestAds,
  };
};

export const getAdMobRuntimeConfig = () => {
  const platform = getAdMobPlatform();
  const formats = Object.values(ADMOB_FORMATS).reduce((accumulator, format) => {
    accumulator[format] = getAdMobAdUnitConfig(format, platform);
    return accumulator;
  }, {});

  return {
    formats,
    isNativePlatform: isAdMobNativePlatform(),
    platform,
    productionModeRequested: isAdMobProductionModeRequested(),
    testDeviceIds: getAdMobTestDeviceIds(),
    useTestAds: isUsingAdMobTestAds(),
  };
};

export const maskAdMobAdUnitId = (adId) => {
  if (!adId) return "missing";
  if (isUsingAdMobTestAds()) return adId;

  const [publisherPart, unitPart] = String(adId).split("/");
  const publisherSuffix = publisherPart?.slice(-4) || "????";
  const unitSuffix = unitPart?.slice(-4) || "????";
  return `ca-app-pub-****${publisherSuffix}/****${unitSuffix}`;
};

export const getMaskedAdMobFormatConfig = () => {
  const runtimeConfig = getAdMobRuntimeConfig();

  return {
    ...runtimeConfig,
    formats: Object.entries(runtimeConfig.formats).reduce((accumulator, [format, config]) => {
      accumulator[format] = {
        ...config,
        adId: maskAdMobAdUnitId(config.adId),
      };
      return accumulator;
    }, {}),
  };
};
