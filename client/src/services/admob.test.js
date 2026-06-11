import { Capacitor } from '@capacitor/core';
import {
  ADMOB_FORMATS,
  getAdMobAdUnitConfig,
  isAdMobFullScreenAdShowing,
  isUsingAdMobTestAds,
  showAdMobBanner,
  showAdMobInterstitial,
} from './admob';
import {
  APP_OPEN_COOLDOWN_MS,
  INTERSTITIAL_COOLDOWN_MS,
  INTERSTITIAL_DAILY_CAP,
  INTERSTITIAL_PLACEMENTS,
  getProductDetailInterstitialInterval,
  isProductDetailInterstitialMilestone,
  canShowAppOpenAd,
  canShowInterstitialAd,
  recordAppOpenShown,
  recordInterstitialShown,
  resetAppOpenState,
  resetInterstitialState,
} from './admob/cooldowns';
import { isAdMobDebugPanelEnabled } from '../components/AdMobDebugPanel';

const mockAdMobListeners = {};

jest.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: jest.fn(() => false),
    getPlatform: jest.fn(() => 'android'),
  },
}));

jest.mock('@capacitor-community/admob', () => ({
  AdMob: {
    initialize: jest.fn(() => Promise.resolve()),
    requestConsentInfo: jest.fn(() => Promise.resolve({ canRequestAds: true })),
    showConsentForm: jest.fn(() => Promise.resolve({ canRequestAds: true })),
    showBanner: jest.fn(() => Promise.resolve()),
    hideBanner: jest.fn(() => Promise.resolve()),
    removeBanner: jest.fn(() => Promise.resolve()),
    prepareInterstitial: jest.fn(() => Promise.resolve()),
    showInterstitial: jest.fn(() => Promise.resolve()),
    addListener: jest.fn((eventName, callback) => {
      mockAdMobListeners[eventName] = callback;
      return { remove: jest.fn() };
    }),
  },
  BannerAdSize: {
    ADAPTIVE_BANNER: 'ADAPTIVE_BANNER',
    BANNER: 'BANNER',
  },
  BannerAdPosition: {
    BOTTOM_CENTER: 'BOTTOM_CENTER',
  },
  BannerAdPluginEvents: {
    Loaded: 'Loaded',
    FailedToLoad: 'FailedToLoad',
    SizeChanged: 'SizeChanged',
  },
  InterstitialAdPluginEvents: {
    Loaded: 'InterstitialLoaded',
    FailedToLoad: 'InterstitialFailedToLoad',
    Dismissed: 'InterstitialDismissed',
    FailedToShow: 'InterstitialFailedToShow',
    Showed: 'InterstitialShowed',
  },
  AdmobConsentStatus: {
    REQUIRED: 'REQUIRED',
  },
}));

const ENV_KEYS = [
  'NODE_ENV',
  'REACT_APP_USE_ADMOB_TEST_ADS',
  'REACT_APP_ADMOB_ANDROID_BANNER_ID',
  'REACT_APP_ADMOB_ANDROID_INTERSTITIAL_ID',
  'REACT_APP_ADMOB_ANDROID_REWARDED_ID',
  'REACT_APP_ADMOB_ANDROID_APP_OPEN_ID',
  'REACT_APP_ADMOB_ANDROID_NATIVE_ID',
  'REACT_APP_ADMOB_IOS_BANNER_ID',
  'REACT_APP_ADMOB_IOS_INTERSTITIAL_ID',
  'REACT_APP_ADMOB_IOS_REWARDED_ID',
  'REACT_APP_ADMOB_IOS_APP_OPEN_ID',
  'REACT_APP_ADMOB_IOS_NATIVE_ID',
  'REACT_APP_ADMOB_PRODUCT_DETAIL_INTERSTITIAL_INTERVAL',
  'REACT_APP_ADMOB_TEST_DEVICE_IDS',
];

const originalEnv = ENV_KEYS.reduce((accumulator, key) => {
  accumulator[key] = process.env[key];
  return accumulator;
}, {});

const restoreEnv = () => {
  ENV_KEYS.forEach((key) => {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  });
};

beforeEach(() => {
  restoreEnv();
  jest.clearAllMocks();
  localStorage.clear();
  Object.keys(mockAdMobListeners).forEach((eventName) => {
    delete mockAdMobListeners[eventName];
  });
  resetInterstitialState();
  resetAppOpenState();
  Capacitor.isNativePlatform.mockReturnValue(false);
  Capacitor.getPlatform.mockReturnValue('android');
});

afterAll(() => {
  restoreEnv();
});

test('test mode uses Google demo IDs for supported formats', () => {
  delete process.env.REACT_APP_USE_ADMOB_TEST_ADS;

  expect(isUsingAdMobTestAds()).toBe(true);
  expect(getAdMobAdUnitConfig(ADMOB_FORMATS.BANNER)).toMatchObject({
    adId: 'ca-app-pub-3940256099942544/6300978111',
    configured: true,
    source: 'google-demo',
    useTestAds: true,
  });
  expect(getAdMobAdUnitConfig(ADMOB_FORMATS.INTERSTITIAL)).toMatchObject({
    adId: 'ca-app-pub-3940256099942544/1033173712',
    configured: true,
  });
  expect(getAdMobAdUnitConfig(ADMOB_FORMATS.NATIVE)).toMatchObject({
    adId: 'ca-app-pub-3940256099942544/2247696110',
    configured: true,
  });
});

test('iOS test mode uses Google demo iOS ad unit IDs', () => {
  process.env.NODE_ENV = 'production';
  process.env.REACT_APP_USE_ADMOB_TEST_ADS = 'true';

  expect(isUsingAdMobTestAds()).toBe(true);
  expect(getAdMobAdUnitConfig(ADMOB_FORMATS.BANNER, 'ios')).toMatchObject({
    adId: 'ca-app-pub-3940256099942544/2934735716',
    configured: true,
    platform: 'ios',
    source: 'google-demo',
    useTestAds: true,
  });
  expect(getAdMobAdUnitConfig(ADMOB_FORMATS.INTERSTITIAL, 'ios')).toMatchObject({
    adId: 'ca-app-pub-3940256099942544/4411468910',
    configured: true,
  });
});

test('production mode requires env production IDs', () => {
  process.env.NODE_ENV = 'production';
  process.env.REACT_APP_USE_ADMOB_TEST_ADS = 'false';
  process.env.REACT_APP_ADMOB_ANDROID_BANNER_ID = 'ca-app-pub-1111222233334444/5555666677';
  process.env.REACT_APP_ADMOB_ANDROID_NATIVE_ID = 'ca-app-pub-1111222233334444/9999000011';
  delete process.env.REACT_APP_ADMOB_ANDROID_INTERSTITIAL_ID;

  expect(isUsingAdMobTestAds()).toBe(false);
  expect(getAdMobAdUnitConfig(ADMOB_FORMATS.BANNER)).toMatchObject({
    adId: 'ca-app-pub-1111222233334444/5555666677',
    configured: true,
    source: 'env-production',
    useTestAds: false,
  });
  expect(getAdMobAdUnitConfig(ADMOB_FORMATS.INTERSTITIAL)).toMatchObject({
    adId: '',
    configured: false,
    source: 'env-production',
    useTestAds: false,
  });
  expect(getAdMobAdUnitConfig(ADMOB_FORMATS.NATIVE)).toMatchObject({
    adId: 'ca-app-pub-1111222233334444/9999000011',
    configured: true,
    source: 'env-production',
    useTestAds: false,
  });
});

test('iOS production mode uses iOS env production IDs when present', () => {
  process.env.NODE_ENV = 'production';
  process.env.REACT_APP_USE_ADMOB_TEST_ADS = 'false';
  process.env.REACT_APP_ADMOB_IOS_BANNER_ID = 'ca-app-pub-1111222233334444/5555666677';
  process.env.REACT_APP_ADMOB_IOS_INTERSTITIAL_ID = 'ca-app-pub-1111222233334444/8888999900';
  delete process.env.REACT_APP_ADMOB_IOS_REWARDED_ID;

  expect(isUsingAdMobTestAds()).toBe(false);
  expect(getAdMobAdUnitConfig(ADMOB_FORMATS.BANNER, 'ios')).toMatchObject({
    adId: 'ca-app-pub-1111222233334444/5555666677',
    configured: true,
    platform: 'ios',
    source: 'env-production',
    useTestAds: false,
  });
  expect(getAdMobAdUnitConfig(ADMOB_FORMATS.INTERSTITIAL, 'ios')).toMatchObject({
    adId: 'ca-app-pub-1111222233334444/8888999900',
    configured: true,
  });
  expect(getAdMobAdUnitConfig(ADMOB_FORMATS.REWARDED, 'ios')).toMatchObject({
    adId: '',
    configured: false,
    source: 'env-production',
    useTestAds: false,
  });
});

test('browser/web platform skips banner without crashing', async () => {
  Capacitor.isNativePlatform.mockReturnValue(false);

  await expect(showAdMobBanner()).resolves.toBe(false);
});

test('product-detail interstitial milestone triggers every two detail views by default', () => {
  delete process.env.REACT_APP_ADMOB_PRODUCT_DETAIL_INTERSTITIAL_INTERVAL;

  expect(getProductDetailInterstitialInterval()).toBe(2);
  expect(isProductDetailInterstitialMilestone(1)).toBe(false);
  expect(isProductDetailInterstitialMilestone(2)).toBe(true);
  expect(isProductDetailInterstitialMilestone(4)).toBe(true);
});

test('product-detail interstitial env interval enforces a minimum of two', () => {
  process.env.REACT_APP_ADMOB_PRODUCT_DETAIL_INTERSTITIAL_INTERVAL = '1';
  expect(getProductDetailInterstitialInterval()).toBe(2);

  process.env.REACT_APP_ADMOB_PRODUCT_DETAIL_INTERSTITIAL_INTERVAL = 'invalid';
  expect(getProductDetailInterstitialInterval()).toBe(2);

  process.env.REACT_APP_ADMOB_PRODUCT_DETAIL_INTERSTITIAL_INTERVAL = '3';
  expect(getProductDetailInterstitialInterval()).toBe(3);
  expect(isProductDetailInterstitialMilestone(2)).toBe(false);
  expect(isProductDetailInterstitialMilestone(3)).toBe(true);
});

test('interstitial cooldown blocks repeat shows until the minimum interval passes', () => {
  const now = Date.UTC(2026, 0, 2, 10, 0, 0);

  expect(canShowInterstitialAd({
    currentPath: '/browse',
    now,
    placement: INTERSTITIAL_PLACEMENTS.PRODUCT_DETAIL_RETURN,
  })).toMatchObject({ allowed: true });

  recordInterstitialShown(now);

  expect(canShowInterstitialAd({
    currentPath: '/browse',
    now: now + INTERSTITIAL_COOLDOWN_MS - 1,
    placement: INTERSTITIAL_PLACEMENTS.PRODUCT_DETAIL_RETURN,
  })).toMatchObject({ allowed: false, reason: 'cooldown' });

  expect(canShowInterstitialAd({
    currentPath: '/browse',
    now: now + INTERSTITIAL_COOLDOWN_MS,
    placement: INTERSTITIAL_PLACEMENTS.PRODUCT_DETAIL_RETURN,
  })).toMatchObject({ allowed: true });
});

test('interstitial show dispatches fullscreen state events and clears them on dismiss', async () => {
  Capacitor.isNativePlatform.mockReturnValue(true);
  const events = [];
  const handleShowing = (event) => events.push({ type: 'showing', detail: event.detail });
  const handleHidden = (event) => events.push({ type: 'hidden', detail: event.detail });

  window.addEventListener('goodone:admob-fullscreen-showing', handleShowing);
  window.addEventListener('goodone:admob-fullscreen-hidden', handleHidden);

  const result = await showAdMobInterstitial({
    currentPath: '/browse',
    placement: INTERSTITIAL_PLACEMENTS.PRODUCT_DETAIL_RETURN,
  });

  expect(result).toBe(true);
  expect(isAdMobFullScreenAdShowing()).toBe(true);
  expect(events).toEqual(expect.arrayContaining([
    expect.objectContaining({
      type: 'showing',
      detail: expect.objectContaining({
        format: ADMOB_FORMATS.INTERSTITIAL,
        phase: 'loading',
        showing: true,
        useTestAds: true,
      }),
    }),
  ]));

  mockAdMobListeners.InterstitialDismissed();

  expect(isAdMobFullScreenAdShowing()).toBe(false);
  expect(events).toEqual(expect.arrayContaining([
    expect.objectContaining({
      type: 'hidden',
      detail: expect.objectContaining({
        format: ADMOB_FORMATS.INTERSTITIAL,
        phase: 'dismissed',
        showing: false,
      }),
    }),
  ]));

  window.removeEventListener('goodone:admob-fullscreen-showing', handleShowing);
  window.removeEventListener('goodone:admob-fullscreen-hidden', handleHidden);
});

test('daily interstitial cap blocks the fourth show in the same day', () => {
  const now = Date.UTC(2026, 0, 2, 10, 0, 0);

  for (let index = 0; index < INTERSTITIAL_DAILY_CAP; index += 1) {
    recordInterstitialShown(now + index * INTERSTITIAL_COOLDOWN_MS);
  }

  expect(canShowInterstitialAd({
    currentPath: '/browse',
    now: now + 12 * INTERSTITIAL_COOLDOWN_MS,
    placement: INTERSTITIAL_PLACEMENTS.PRODUCT_DETAIL_RETURN,
  })).toMatchObject({ allowed: false, reason: 'daily-cap' });
});

test('app-open cooldown blocks resume ads for four hours', () => {
  const now = Date.UTC(2026, 0, 2, 10, 0, 0);

  expect(canShowAppOpenAd({ currentPath: '/browse', now })).toMatchObject({ allowed: true });

  recordAppOpenShown(now);

  expect(canShowAppOpenAd({
    currentPath: '/browse',
    now: now + APP_OPEN_COOLDOWN_MS - 1,
  })).toMatchObject({ allowed: false, reason: 'cooldown' });

  expect(canShowAppOpenAd({
    currentPath: '/browse',
    now: now + APP_OPEN_COOLDOWN_MS,
  })).toMatchObject({ allowed: true });
});

test('interstitial policy blocks login, register, forgot password, chat, product posting, and app launch', () => {
  ['/login', '/register', '/register/customer', '/forgot-password', '/chat/abc', '/dashboard/add-product'].forEach((currentPath) => {
    expect(canShowInterstitialAd({
      currentPath,
      placement: INTERSTITIAL_PLACEMENTS.PRODUCT_DETAIL_RETURN,
    })).toMatchObject({ allowed: false, reason: 'sensitive-route' });
  });

  expect(canShowInterstitialAd({
    currentPath: '/browse',
    placement: 'app-launch',
  })).toMatchObject({ allowed: false, reason: 'blocked-app-launch' });
});

test('AdMob debug panel is hidden for normal production users', () => {
  expect(isAdMobDebugPanelEnabled({
    localStorageFlag: false,
    nodeEnv: 'production',
    useTestAds: false,
  })).toBe(false);
});
