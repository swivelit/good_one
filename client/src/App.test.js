import fs from 'fs';
import path from 'path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { AdMob } from '@capacitor-community/admob';
import API from './api';
import App from './App';
import AppVideoManager, {
  BANNER_ONLY_PHASE_MS,
  GOODONE_ADMOB_FULLSCREEN_HIDDEN_EVENT,
  GOODONE_ADMOB_FULLSCREEN_SHOWING_EVENT,
  GOODONE_ADMOB_NATIVE_HIDDEN_EVENT,
  GOODONE_ADMOB_NATIVE_VISIBLE_EVENT,
  LOCAL_FLOATING_VIDEO_STORAGE_KEY,
  LOCAL_VIDEO_DURATION_MS,
  POPUP_REPEAT_INTERVAL_MS,
  getLocalFloatingVideoTiming,
  isLocalFloatingVideoAdEnabled,
  isLocalFloatingVideoRouteAllowed,
  syncNativeViewportCssVariables,
} from './components/AppVideoManager';
import ForceUpdateGate from './components/ForceUpdateGate';
import { getNativeBackTarget } from './components/NativeBackButtonHandler';
import MobileWelcomePage from './pages/MobileWelcomePage';

const mockAdMobListeners = {};
const mockCapacitorAppListeners = {};
let mockRouterPathname = '/';
const androidResDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
const androidBuildGradlePath = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
const androidManifestPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
const mainActivityPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'com', 'goodone', 'marketplace', 'MainActivity.java');
const nativeAdPluginPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'com', 'goodone', 'marketplace', 'ads', 'NativeAdPlugin.java');
const nativeAdLayoutPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'layout', 'goodone_native_ad_view.xml');
const debugBuildScriptPath = path.join(__dirname, '..', '..', 'scripts', 'build-android-apk.sh');
const releaseBuildScriptPath = path.join(__dirname, '..', '..', 'scripts', 'build-android_release-apk.sh');
const debugLaunchScriptPath = path.join(__dirname, '..', '..', 'launch-debug_apk.sh');
const LOCAL_VIDEO_ENV_KEYS = [
  'REACT_APP_ENABLE_LOCAL_FLOATING_VIDEO_AD',
  'REACT_APP_LOCAL_FLOATING_VIDEO_REPEAT_MS',
  'REACT_APP_LOCAL_FLOATING_VIDEO_DURATION_MS',
];
const originalLocalVideoEnv = LOCAL_VIDEO_ENV_KEYS.reduce((accumulator, key) => {
  accumulator[key] = process.env[key];
  return accumulator;
}, {});

const walkFiles = (directory) => (
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(entryPath) : entryPath;
  })
);

jest.mock('@capacitor/core', () => ({
  registerPlugin: jest.fn(() => ({})),
  Capacitor: {
    isNativePlatform: jest.fn(() => false),
    getPlatform: jest.fn(() => 'android'),
  },
}));

jest.mock('@capacitor/app', () => ({
  App: {
    addListener: jest.fn((eventName, callback) => {
      mockCapacitorAppListeners[eventName] = callback;
      return Promise.resolve({ remove: jest.fn() });
    }),
    minimizeApp: jest.fn(() => Promise.resolve()),
    exitApp: jest.fn(() => Promise.resolve()),
    getInfo: jest.fn(() => Promise.resolve({ version: '1.3', build: '4' })),
  },
}));

jest.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    checkPermissions: jest.fn(() => Promise.resolve({ receive: 'denied' })),
    requestPermissions: jest.fn(() => Promise.resolve({ receive: 'denied' })),
    register: jest.fn(() => Promise.resolve()),
    addListener: jest.fn(() => Promise.resolve({ remove: jest.fn() })),
  },
}));

jest.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: jest.fn(() => Promise.resolve({ display: 'denied' })),
    requestPermissions: jest.fn(() => Promise.resolve({ display: 'denied' })),
    createChannel: jest.fn(() => Promise.resolve()),
    schedule: jest.fn(() => Promise.resolve()),
    addListener: jest.fn(() => Promise.resolve({ remove: jest.fn() })),
  },
}));

jest.mock('@capacitor/share', () => ({
  Share: {
    share: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('@capacitor-community/admob', () => ({
  AdMob: {
    initialize: jest.fn(() => Promise.resolve()),
    requestConsentInfo: jest.fn(() => Promise.resolve({ canRequestAds: true })),
    showConsentForm: jest.fn(() => Promise.resolve({ canRequestAds: true })),
    addListener: jest.fn((eventName, callback) => {
      mockAdMobListeners[eventName] = callback;
      return { remove: jest.fn() };
    }),
    showBanner: jest.fn(() => Promise.resolve()),
    hideBanner: jest.fn(() => Promise.resolve()),
    removeBanner: jest.fn(() => Promise.resolve()),
    prepareInterstitial: jest.fn(() => Promise.resolve()),
    showInterstitial: jest.fn(() => Promise.resolve()),
    prepareRewardVideoAd: jest.fn(() => Promise.resolve()),
    showRewardVideoAd: jest.fn(() => Promise.resolve({ type: 'coin', amount: 1 })),
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
    Opened: 'Opened',
    Closed: 'Closed',
    AdImpression: 'AdImpression',
  },
  InterstitialAdPluginEvents: {
    Loaded: 'InterstitialLoaded',
    FailedToLoad: 'InterstitialFailedToLoad',
    Dismissed: 'InterstitialDismissed',
    FailedToShow: 'InterstitialFailedToShow',
    Showed: 'InterstitialShowed',
  },
  RewardAdPluginEvents: {
    Loaded: 'RewardLoaded',
    FailedToLoad: 'RewardFailedToLoad',
    Rewarded: 'Rewarded',
    Dismissed: 'RewardDismissed',
    FailedToShow: 'RewardFailedToShow',
    Showed: 'RewardShowed',
  },
  AdmobConsentStatus: {
    REQUIRED: 'REQUIRED',
  },
}));

jest.mock('react-router-dom', () => {
  const React = require('react');

  return {
    BrowserRouter: ({ children }) => <>{children}</>,
    HashRouter: ({ children }) => <>{children}</>,
    Routes: ({ children }) => <>{children}</>,
    Route: ({ path }) => <div data-testid={`route-${path}`} />,
    Navigate: () => null,
    Link: ({ children, to, ...props }) => (
      <a href={typeof to === 'string' ? to : '#'} {...props}>
        {children}
      </a>
    ),
    useNavigate: () => jest.fn(),
    useLocation: () => ({ pathname: mockRouterPathname, search: '', hash: '', state: null }),
    useParams: () => ({}),
    useSearchParams: () => [new URLSearchParams(), jest.fn()],
  };
}, { virtual: true });

const restoreLocalVideoEnv = () => {
  LOCAL_VIDEO_ENV_KEYS.forEach((key) => {
    if (originalLocalVideoEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalLocalVideoEnv[key];
    }
  });
};

beforeEach(() => {
  LOCAL_VIDEO_ENV_KEYS.forEach((key) => {
    delete process.env[key];
  });
  Object.keys(mockCapacitorAppListeners).forEach((eventName) => {
    delete mockCapacitorAppListeners[eventName];
  });
  jest.clearAllMocks();
  mockRouterPathname = '/';
  document.body.className = '';
  document.documentElement.removeAttribute('style');
  jest.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
  Capacitor.isNativePlatform.mockReturnValue(false);
  Capacitor.getPlatform.mockReturnValue('android');
  CapacitorApp.addListener.mockImplementation((eventName, callback) => {
    mockCapacitorAppListeners[eventName] = callback;
    return Promise.resolve({ remove: jest.fn() });
  });
  CapacitorApp.minimizeApp.mockResolvedValue();
  CapacitorApp.exitApp.mockResolvedValue();
  CapacitorApp.getInfo.mockResolvedValue({ version: '1.3', build: '4' });
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  });
  localStorage.clear();
});

afterEach(() => {
  if (API.get.mockRestore) {
    API.get.mockRestore();
  }
  jest.useRealTimers();
});

afterAll(() => {
  restoreLocalVideoEnv();
});

test('renders GoodOne app shell', () => {
  render(<App />);
  expect(screen.getAllByText(/GoodOne/i).length).toBeGreaterThan(0);
});

test('registers profile and account routes', () => {
  render(<App />);

  expect(screen.getByTestId('route-/profile')).toBeInTheDocument();
  expect(screen.getByTestId('route-/account')).toBeInTheDocument();
  expect(screen.getByTestId('route-/forgot-password')).toBeInTheDocument();
});

test('MobileWelcomePage renders native auth choices', () => {
  render(<MobileWelcomePage />);

  expect(screen.getByText(/GoodOne/i)).toBeInTheDocument();
  expect(screen.getByText(/Sign In/i)).toBeInTheDocument();
  expect(screen.getByText(/Create Customer Account/i)).toBeInTheDocument();
  expect(screen.getByText(/Become a Vendor/i)).toBeInTheDocument();
  expect(screen.getByText(/Continue Browsing/i)).toBeInTheDocument();
});

test('native topbar CSS stays white without covering the header or AdMob bottom variables', () => {
  const css = fs.readFileSync(path.join(__dirname, 'index.css'), 'utf8');
  const topbarRule = css.match(/\.native-topbar\s*\{[\s\S]*?\}/)?.[0] || '';
  const nativeModeTopbarRule = css.match(/body\.goodone-native-shell-active\s+\.native-topbar\s*\{[\s\S]*?\}/)?.[0] || '';

  expect(css).not.toMatch(/\.native-topbar::before/);
  expect(topbarRule).toMatch(/background:\s*#fff\s*;/);
  expect(nativeModeTopbarRule).toMatch(/background:\s*#fff\s*!important\s*;/);
  expect(nativeModeTopbarRule).toMatch(/color:\s*var\(--secondary\)\s*!important\s*;/);
  expect(css).toMatch(/--goodone-admob-banner-height\s*:/);
  expect(css).toMatch(/--goodone-native-bottom-nav-height\s*:/);
});

test('Android launch theme stays light without native splash resources', () => {
  const styles = fs.readFileSync(path.join(androidResDir, 'values', 'styles.xml'), 'utf8');

  expect(styles).not.toMatch(/Theme\.SplashScreen/);
  expect(styles).not.toMatch(/@drawable\/splash/);
  expect(styles).not.toMatch(/DayNight\.NoActionBar/);
  expect(styles).toMatch(/Theme\.AppCompat\.Light\.NoActionBar/);
  expect(styles).toMatch(/android:forceDarkAllowed/);
  expect(styles).toMatch(/@android:color\/white/);
});

test('Android night resources do not include splash PNGs', () => {
  const nightSplashFiles = walkFiles(androidResDir)
    .map((filePath) => path.relative(androidResDir, filePath).split(path.sep).join('/'))
    .filter((filePath) => /night.*splash\.png/i.test(filePath));

  expect(nightSplashFiles).toEqual([]);
});

test('Android Gradle config includes Play app-update dependency', () => {
  const buildGradle = fs.readFileSync(androidBuildGradlePath, 'utf8');

  expect(buildGradle).toMatch(/com\.google\.android\.play:app-update:2\.1\.0/);
});

test('MainActivity includes immediate Play update support', () => {
  const mainActivity = fs.readFileSync(mainActivityPath, 'utf8');

  expect(mainActivity).toMatch(/AppUpdateManagerFactory/);
  expect(mainActivity).toMatch(/AppUpdateType\.IMMEDIATE/);
  expect(mainActivity).toMatch(/DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS/);
});

test('MainActivity safe-area CSS event uses the expected String.format argument order', () => {
  const mainActivity = fs.readFileSync(mainActivityPath, 'utf8');

  expect(mainActivity).toMatch(
    /String\.format\(Locale\.US,[\s\S]*?top,\s*right,\s*bottom,\s*left,\s*rawTop,\s*GOODONE_SAFE_AREA_CHANGE_EVENT\s*\)/
  );
});

test('Android registers SDK-owned native in-feed ad plugin', () => {
  const mainActivity = fs.readFileSync(mainActivityPath, 'utf8');
  const nativeAdPlugin = fs.readFileSync(nativeAdPluginPath, 'utf8');
  const nativeAdLayout = fs.readFileSync(nativeAdLayoutPath, 'utf8');

  expect(mainActivity).toMatch(/registerPlugin\(NativeAdPlugin\.class\)/);
  expect(nativeAdPlugin).toMatch(/@CapacitorPlugin\(name = "NativeAd"\)/);
  expect(nativeAdPlugin).toMatch(/MobileAds\.initialize/);
  expect(nativeAdPlugin).toMatch(/AdLoader\.Builder/);
  expect(nativeAdPlugin).toMatch(/NativeAdView/);
  expect(nativeAdPlugin).toMatch(/setNativeAd\(nativeAd\)/);
  expect(nativeAdLayout).toMatch(/com\.google\.android\.gms\.ads\.nativead\.NativeAdView/);
  expect(nativeAdLayout).toMatch(/com\.google\.android\.gms\.ads\.nativead\.MediaView/);
});

test('NativeAdPlugin keeps blank native ads invisible unless renderable', () => {
  const nativeAdPlugin = fs.readFileSync(nativeAdPluginPath, 'utf8');

  expect(nativeAdPlugin).toMatch(/private boolean renderable = false/);
  expect(nativeAdPlugin).toMatch(/renderFailureReason/);
  expect(nativeAdPlugin).toMatch(/slot\.loaded && slot\.renderable && slot\.showRequested && slot\.viewportVisible/);
  expect(nativeAdPlugin).toMatch(/missing-headline/);
  expect(nativeAdPlugin).toMatch(/missing-secondary-asset/);
  expect(nativeAdPlugin).toMatch(/View\.GONE/);
});

test('NativeAdPlugin logs asset diagnostics and AdMob lifecycle callbacks', () => {
  const nativeAdPlugin = fs.readFileSync(nativeAdPluginPath, 'utf8');

  expect(nativeAdPlugin).toMatch(/GoodOneNativeAd/);
  expect(nativeAdPlugin).toMatch(/headlinePresent/);
  expect(nativeAdPlugin).toMatch(/bodyPresent/);
  expect(nativeAdPlugin).toMatch(/ctaPresent/);
  expect(nativeAdPlugin).toMatch(/iconPresent/);
  expect(nativeAdPlugin).toMatch(/advertiserPresent/);
  expect(nativeAdPlugin).toMatch(/mediaPresent/);
  expect(nativeAdPlugin).toMatch(/hasVideoContent/);
  expect(nativeAdPlugin).toMatch(/getResponseId/);
  expect(nativeAdPlugin).toMatch(/getMediationAdapterClassName/);
  expect(nativeAdPlugin).toMatch(/onAdLoaded/);
  expect(nativeAdPlugin).toMatch(/onAdFailedToLoad/);
  expect(nativeAdPlugin).toMatch(/onAdImpression/);
  expect(nativeAdPlugin).toMatch(/onAdClicked/);
  expect(nativeAdPlugin).toMatch(/onAdOpened/);
  expect(nativeAdPlugin).toMatch(/onAdClosed/);
});

test('Native ad layout keeps attribution, headline, and CTA outside optional media', () => {
  const nativeAdLayout = fs.readFileSync(nativeAdLayoutPath, 'utf8');
  const attributionIndex = nativeAdLayout.indexOf('goodone_native_ad_attribution');
  const headlineIndex = nativeAdLayout.indexOf('goodone_native_ad_headline');
  const ctaIndex = nativeAdLayout.indexOf('goodone_native_ad_call_to_action');
  const mediaContainerIndex = nativeAdLayout.indexOf('goodone_native_ad_media_container');

  expect(attributionIndex).toBeGreaterThan(-1);
  expect(headlineIndex).toBeGreaterThan(-1);
  expect(ctaIndex).toBeGreaterThan(-1);
  expect(mediaContainerIndex).toBeGreaterThan(-1);
  expect(attributionIndex).toBeLessThan(mediaContainerIndex);
  expect(headlineIndex).toBeLessThan(mediaContainerIndex);
  expect(ctaIndex).toBeLessThan(mediaContainerIndex);
  expect(nativeAdLayout).toMatch(/android:id="@\+id\/goodone_native_ad_media_container"[\s\S]*android:visibility="gone"/);
  const mediaContainerTag = nativeAdLayout.match(/<FrameLayout[\s\S]*?goodone_native_ad_media_container[\s\S]*?>/)?.[0] || '';
  expect(mediaContainerTag).toMatch(/android:layout_height="104dp"/);
  expect(mediaContainerTag).not.toMatch(/android:layout_height="match_parent"/);
});

test('Android manifest enables hardware acceleration for AdMob rendering', () => {
  const manifest = fs.readFileSync(androidManifestPath, 'utf8');

  expect(manifest).toMatch(/<application[\s\S]*android:hardwareAccelerated="true"/);
  expect(manifest).toMatch(/<activity[\s\S]*android:name="\.MainActivity"[\s\S]*android:hardwareAccelerated="true"/);
});

test('Android build scripts keep debug test ads and require a release native ID', () => {
  const debugBuildScript = fs.readFileSync(debugBuildScriptPath, 'utf8');
  const releaseBuildScript = fs.readFileSync(releaseBuildScriptPath, 'utf8');
  const launchScript = fs.readFileSync(debugLaunchScriptPath, 'utf8');

  expect(debugBuildScript).toMatch(/ALLOW_LIVE_ADS_IN_DEBUG/);
  expect(debugBuildScript).toMatch(/USE_ADMOB_TEST_ADS=true/);
  expect(releaseBuildScript).toMatch(/REACT_APP_ADMOB_ANDROID_NATIVE_ID/);
  expect(releaseBuildScript).toMatch(/Native Advanced ad ID must not match the banner ad ID/);
  expect(launchScript).toMatch(/GoodOneNativeAd/);
  expect(launchScript).toMatch(/MobileAds/);
  expect(launchScript).toMatch(/chromium/);
  expect(launchScript).toMatch(/screencap -p/);
});

test('NativeBackButtonHandler returns product source path when it is safe', () => {
  expect(getNativeBackTarget({
    pathname: '/products/123',
    state: { from: '/browse?category=Mobiles' },
  })).toEqual({
    action: 'navigate',
    to: '/browse?category=Mobiles',
    replace: true,
  });
});

test('NativeBackButtonHandler returns browse for product detail without source state', () => {
  expect(getNativeBackTarget({
    pathname: '/products/123',
    state: null,
  })).toEqual({
    action: 'navigate',
    to: '/browse',
    replace: true,
  });
});

test('NativeBackButtonHandler ignores unsafe external product source state', () => {
  expect(getNativeBackTarget({
    pathname: '/products/123',
    state: { from: 'https://example.com/browse' },
  })).toEqual({
    action: 'navigate',
    to: '/browse',
    replace: true,
  });
});

test('NativeBackButtonHandler minimizes on root browse path', () => {
  expect(getNativeBackTarget({
    pathname: '/browse',
  })).toEqual({ action: 'minimize' });
});

test('NativeBackButtonHandler clears browse search instead of minimizing', () => {
  expect(getNativeBackTarget({
    pathname: '/browse',
    search: '?search=phone',
  })).toEqual({
    action: 'navigate',
    to: '/browse',
    replace: true,
  });
});

test('NativeBackButtonHandler clears root query and hash instead of minimizing', () => {
  expect(getNativeBackTarget({
    pathname: '/',
    search: '?search=phone',
    hash: '#top',
  })).toEqual({
    action: 'navigate',
    to: '/',
    replace: true,
  });
});

test('NativeBackButtonHandler still minimizes on browse without query or hash', () => {
  expect(getNativeBackTarget({
    pathname: '/browse',
    search: '',
    hash: '',
  })).toEqual({ action: 'minimize' });
});

test('AppVideoManager stays hidden on web', () => {
  Capacitor.isNativePlatform.mockReturnValue(false);
  localStorage.setItem(LOCAL_FLOATING_VIDEO_STORAGE_KEY, 'true');

  const { container } = render(<AppVideoManager />);

  expect(container.querySelector('.app-video-splash')).not.toBeInTheDocument();
  expect(container.querySelector('.floating-video-widget')).not.toBeInTheDocument();
});

test('local floating video is disabled by default on native Android', () => {
  expect(isLocalFloatingVideoAdEnabled({
    isNative: true,
    platform: 'android',
  })).toBe(false);
  process.env.REACT_APP_ENABLE_LOCAL_FLOATING_VIDEO_AD = 'true';
  expect(isLocalFloatingVideoAdEnabled({
    isNative: true,
    platform: 'android',
  })).toBe(true);
  expect(isLocalFloatingVideoAdEnabled({
    isNative: true,
    platform: 'ios',
  })).toBe(false);
});

test('local floating video timing defaults to the restored 20-second cycle', () => {
  expect(POPUP_REPEAT_INTERVAL_MS).toBe(20000);
  expect(LOCAL_VIDEO_DURATION_MS).toBe(10000);
  expect(BANNER_ONLY_PHASE_MS).toBe(10000);
  expect(getLocalFloatingVideoTiming()).toEqual({
    popupRepeatIntervalMs: 20000,
    localVideoDurationMs: 10000,
    bannerOnlyPhaseMs: 10000,
  });
});

test('local floating video timing env values enforce safe bounds', () => {
  process.env.REACT_APP_LOCAL_FLOATING_VIDEO_REPEAT_MS = '30000';
  process.env.REACT_APP_LOCAL_FLOATING_VIDEO_DURATION_MS = '15000';

  expect(getLocalFloatingVideoTiming()).toEqual({
    popupRepeatIntervalMs: 30000,
    localVideoDurationMs: 15000,
    bannerOnlyPhaseMs: 15000,
  });

  expect(getLocalFloatingVideoTiming({
    repeatMs: '1000',
    durationMs: '3000',
  })).toEqual({
    popupRepeatIntervalMs: 20000,
    localVideoDurationMs: 10000,
    bannerOnlyPhaseMs: 10000,
  });

  expect(getLocalFloatingVideoTiming({
    repeatMs: '20000',
    durationMs: '30000',
  })).toEqual({
    popupRepeatIntervalMs: 20000,
    localVideoDurationMs: 20000,
    bannerOnlyPhaseMs: 0,
  });
});

test('local floating video route policy blocks sensitive routes', () => {
  expect(isLocalFloatingVideoRouteAllowed('/browse')).toBe(true);
  expect(isLocalFloatingVideoRouteAllowed('/login')).toBe(false);
  expect(isLocalFloatingVideoRouteAllowed('/register/customer')).toBe(false);
  expect(isLocalFloatingVideoRouteAllowed('/forgot-password')).toBe(false);
  expect(isLocalFloatingVideoRouteAllowed('/chat/abc')).toBe(false);
  expect(isLocalFloatingVideoRouteAllowed('/dashboard/add-product')).toBe(false);
});

test('AppVideoManager does not render startup splash in native Capacitor mode', () => {
  Capacitor.isNativePlatform.mockReturnValue(true);

  const { container } = render(<AppVideoManager />);

  expect(container.querySelector('.app-video-splash')).not.toBeInTheDocument();
});

test('AppVideoManager adds the native body class in native Capacitor mode', () => {
  Capacitor.isNativePlatform.mockReturnValue(true);

  render(<AppVideoManager />);

  expect(document.body).toHaveClass('goodone-native-shell-active');
});

test('syncNativeViewportCssVariables writes visualViewport dimensions to CSS variables', () => {
  const previousVisualViewport = window.visualViewport;
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: {
      width: 390,
      height: 741,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
  });

  syncNativeViewportCssVariables();

  expect(document.documentElement.style.getPropertyValue('--goodone-viewport-height')).toBe('741px');
  expect(document.documentElement.style.getPropertyValue('--goodone-viewport-width')).toBe('390px');

  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: previousVisualViewport,
  });
});

const flushPromises = async () => {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
};

test('ForceUpdateGate renders nothing on web', () => {
  Capacitor.isNativePlatform.mockReturnValue(false);

  const { container } = render(<ForceUpdateGate />);

  expect(container).toBeEmptyDOMElement();
});

test('ForceUpdateGate renders blocking overlay when native Android config requires update', async () => {
  Capacitor.isNativePlatform.mockReturnValue(true);
  Capacitor.getPlatform.mockReturnValue('android');
  jest.spyOn(API, 'get').mockResolvedValue({
    data: {
      android: { updateRequired: true },
      playStoreUrl: 'https://play.google.com/store/apps/details?id=com.goodone.marketplace',
    },
  });

  render(<ForceUpdateGate />);

  await act(async () => {
    await flushPromises();
  });

  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByText('Update required')).toBeInTheDocument();
});

test('ForceUpdateGate renders overlay after update-required event', async () => {
  Capacitor.isNativePlatform.mockReturnValue(true);
  Capacitor.getPlatform.mockReturnValue('android');
  jest.spyOn(API, 'get').mockResolvedValue({
    data: {
      android: { updateRequired: false },
      playStoreUrl: 'https://play.google.com/store/apps/details?id=com.goodone.marketplace',
    },
  });

  render(<ForceUpdateGate />);

  await act(async () => {
    await flushPromises();
  });

  act(() => {
    window.dispatchEvent(new CustomEvent('goodone:update-required', {
      detail: {
        code: 'UPDATE_REQUIRED',
        playStoreUrl: 'https://play.google.com/store/apps/details?id=com.goodone.marketplace',
      },
    }));
  });

  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByText('Update required')).toBeInTheDocument();
});

const advanceTimers = async (milliseconds) => {
  await act(async () => {
    jest.advanceTimersByTime(milliseconds);
    await flushPromises();
  });
};

const renderNativeVideoManager = ({ enableLocalVideo = false } = {}) => {
  jest.useFakeTimers();
  Capacitor.isNativePlatform.mockReturnValue(true);
  if (enableLocalVideo) {
    localStorage.setItem(LOCAL_FLOATING_VIDEO_STORAGE_KEY, 'true');
  }

  return render(<AppVideoManager />);
};

const renderNativeAdMobPhase = async () => {
  const view = renderNativeVideoManager();

  await act(async () => {
    await flushPromises();
  });
  return view;
};

const renderNativeLocalVideoPhase = async (options = { enableLocalVideo: true }) => {
  const view = renderNativeVideoManager(options);

  await act(async () => {
    await flushPromises();
  });

  await advanceTimers(BANNER_ONLY_PHASE_MS);
  return view;
};

const expectLastBannerAdId = (adId) => {
  expect(AdMob.showBanner).toHaveBeenLastCalledWith(
    expect.objectContaining({
      adId,
      adSize: 'ADAPTIVE_BANNER',
      position: 'BOTTOM_CENTER',
      margin: 0,
      isTesting: true,
    })
  );
};

const getMockAdMobListener = (eventName) => (
  mockAdMobListeners[eventName] ||
  AdMob.addListener.mock.calls.find(([registeredEventName]) => registeredEventName === eventName)?.[1]
);

const ADMOB_TEST_ENV_KEYS = [
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
  'REACT_APP_ADMOB_TEST_DEVICE_IDS',
];

const showBannerWithIsolatedAdMobEnv = async (envValue, extraEnv = {}) => {
  const previousEnv = ADMOB_TEST_ENV_KEYS.reduce((accumulator, key) => {
    accumulator[key] = process.env[key];
    return accumulator;
  }, {});

  if (envValue === undefined) {
    delete process.env.REACT_APP_USE_ADMOB_TEST_ADS;
  } else {
    process.env.REACT_APP_USE_ADMOB_TEST_ADS = envValue;
  }

  Object.entries(extraEnv).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });

  jest.resetModules();
  const { Capacitor: isolatedCapacitor } = require('@capacitor/core');
  const { AdMob: isolatedAdMob } = require('@capacitor-community/admob');
  isolatedCapacitor.isNativePlatform.mockReturnValue(true);
  isolatedCapacitor.getPlatform.mockReturnValue('android');
  isolatedAdMob.initialize.mockClear();
  isolatedAdMob.requestConsentInfo?.mockClear();
  isolatedAdMob.showConsentForm?.mockClear();
  isolatedAdMob.addListener?.mockClear();
  isolatedAdMob.showBanner.mockClear();

  const { showAdMobBanner } = require('./services/admob');
  const result = await showAdMobBanner();

  ADMOB_TEST_ENV_KEYS.forEach((key) => {
    if (previousEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = previousEnv[key];
    }
  });

  return { isolatedAdMob, result };
};

test('AppVideoManager starts AdMob immediately without rendering startup splash', async () => {
  const { container } = await renderNativeAdMobPhase();

  expect(container.querySelector('.app-video-splash')).not.toBeInTheDocument();
  expect(container.querySelector('.floating-video-widget')).not.toBeInTheDocument();
  expectLastBannerAdId('ca-app-pub-3940256099942544/6300978111');
});

test('AdMob SizeChanged updates the reserved banner height CSS variable', async () => {
  Object.keys(mockAdMobListeners).forEach((eventName) => {
    delete mockAdMobListeners[eventName];
  });
  await showBannerWithIsolatedAdMobEnv(undefined);

  const sizeChangedListener = getMockAdMobListener('SizeChanged');
  expect(sizeChangedListener).toEqual(expect.any(Function));

  act(() => {
    sizeChangedListener({ width: 390, height: 72 });
  });

  expect(document.documentElement.style.getPropertyValue('--goodone-admob-banner-height')).toBe('72px');
});

test('AppVideoManager updates the native bottom nav height CSS variable when nav exists', () => {
  Capacitor.isNativePlatform.mockReturnValue(true);
  const rectSpy = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(function getBoundingClientRect() {
      if (this.classList?.contains('native-bottom-nav')) {
        return {
          width: 390,
          height: 86,
          top: 0,
          right: 390,
          bottom: 86,
          left: 0,
          x: 0,
          y: 0,
          toJSON: () => {},
        };
      }

      return {
        width: 0,
        height: 0,
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        x: 0,
        y: 0,
        toJSON: () => {},
      };
    });

  render(
    <>
      <nav className="native-bottom-nav" aria-label="Native navigation" />
      <AppVideoManager />
    </>
  );

  expect(document.documentElement.style.getPropertyValue('--goodone-native-bottom-nav-height')).toBe('86px');

  rectSpy.mockRestore();
});

test('AppVideoManager keeps local popup video hidden when disabled by env while keeping the bottom banner', async () => {
  process.env.REACT_APP_ENABLE_LOCAL_FLOATING_VIDEO_AD = 'false';
  const { container } = await renderNativeAdMobPhase();

  await advanceTimers(BANNER_ONLY_PHASE_MS + 1);

  expect(container.querySelector('.floating-video-widget')).not.toBeInTheDocument();
  expectLastBannerAdId('ca-app-pub-3940256099942544/6300978111');
});

test('AppVideoManager shows local popup video when explicitly enabled while keeping the bottom banner', async () => {
  const { container } = await renderNativeLocalVideoPhase();

  expect(container.querySelector('.floating-video-widget')).toBeInTheDocument();
  expect(screen.getByLabelText(/close local video promo/i)).toBeInTheDocument();
  expect(AdMob.removeBanner).not.toHaveBeenCalled();
  expectLastBannerAdId('ca-app-pub-3940256099942544/6300978111');
});

test('AppVideoManager allows localStorage to force enable local popup video when env disables it', async () => {
  process.env.REACT_APP_ENABLE_LOCAL_FLOATING_VIDEO_AD = 'false';
  localStorage.setItem(LOCAL_FLOATING_VIDEO_STORAGE_KEY, 'true');

  const { container } = await renderNativeLocalVideoPhase();

  expect(container.querySelector('.floating-video-widget')).toBeInTheDocument();
  expectLastBannerAdId('ca-app-pub-3940256099942544/6300978111');
});

test('AppVideoManager allows localStorage to force disable local popup video', async () => {
  localStorage.setItem(LOCAL_FLOATING_VIDEO_STORAGE_KEY, 'false');
  const { container } = await renderNativeAdMobPhase();

  await advanceTimers(BANNER_ONLY_PHASE_MS + 1);

  expect(container.querySelector('.floating-video-widget')).not.toBeInTheDocument();
  expectLastBannerAdId('ca-app-pub-3940256099942544/6300978111');
});

test('AppVideoManager keeps local popup video hidden on sensitive routes', async () => {
  mockRouterPathname = '/chat/abc';
  const { container } = await renderNativeAdMobPhase();

  await advanceTimers(BANNER_ONLY_PHASE_MS + 1);

  expect(container.querySelector('.floating-video-widget')).not.toBeInTheDocument();
  expectLastBannerAdId('ca-app-pub-3940256099942544/6300978111');
});

test('AppVideoManager returns to AdMob after 10 seconds of local popup video', async () => {
  const { container } = await renderNativeLocalVideoPhase();

  expect(container.querySelector('.floating-video-widget')).toBeInTheDocument();

  await advanceTimers(LOCAL_VIDEO_DURATION_MS);

  expect(container.querySelector('.floating-video-widget')).not.toBeInTheDocument();
  expectLastBannerAdId('ca-app-pub-3940256099942544/6300978111');
});

test('AppVideoManager uses the Android Google demo banner ad unit by default', async () => {
  await renderNativeAdMobPhase();

  expectLastBannerAdId('ca-app-pub-3940256099942544/6300978111');
});

test('AppVideoManager uses the iOS Google demo banner ad unit on iOS', async () => {
  Capacitor.getPlatform.mockReturnValue('ios');

  await renderNativeAdMobPhase();

  expectLastBannerAdId('ca-app-pub-3940256099942544/2934735716');
});

test('AppVideoManager returns to local video after the AdMob phase without removing the bottom banner', async () => {
  const view = renderNativeVideoManager({ enableLocalVideo: true });

  await act(async () => {
    await flushPromises();
  });

  const { container } = view;
  const removeBannerCount = AdMob.removeBanner.mock.calls.length;

  expect(container.querySelector('.floating-video-widget')).not.toBeInTheDocument();

  await advanceTimers(BANNER_ONLY_PHASE_MS - 1);

  expect(container.querySelector('.floating-video-widget')).not.toBeInTheDocument();

  await advanceTimers(1);

  expect(AdMob.removeBanner).toHaveBeenCalledTimes(removeBannerCount);
  expect(container.querySelector('.floating-video-widget')).toBeInTheDocument();
  expectLastBannerAdId('ca-app-pub-3940256099942544/6300978111');
});

test('AppVideoManager hides local popup video when AdMob native or fullscreen events fire', async () => {
  const nativeView = await renderNativeLocalVideoPhase();
  expect(nativeView.container.querySelector('.floating-video-widget')).toBeInTheDocument();

  act(() => {
    window.dispatchEvent(new CustomEvent(GOODONE_ADMOB_NATIVE_VISIBLE_EVENT, {
      detail: { slotId: 'native-slot-1' },
    }));
  });

  expect(nativeView.container.querySelector('.floating-video-widget')).not.toBeInTheDocument();
  nativeView.unmount();

  const fullscreenView = await renderNativeLocalVideoPhase();
  expect(fullscreenView.container.querySelector('.floating-video-widget')).toBeInTheDocument();

  act(() => {
    window.dispatchEvent(new CustomEvent(GOODONE_ADMOB_FULLSCREEN_SHOWING_EVENT, {
      detail: { phase: 'loading' },
    }));
  });

  expect(fullscreenView.container.querySelector('.floating-video-widget')).not.toBeInTheDocument();

  act(() => {
    window.dispatchEvent(new CustomEvent(GOODONE_ADMOB_FULLSCREEN_HIDDEN_EVENT, {
      detail: { phase: 'dismissed' },
    }));
    window.dispatchEvent(new CustomEvent(GOODONE_ADMOB_NATIVE_HIDDEN_EVENT, {
      detail: { slotId: 'native-slot-1' },
    }));
  });
});

test('AppVideoManager clears timers and removes banner on unmount', async () => {
  const { unmount } = renderNativeVideoManager({ enableLocalVideo: true });

  unmount();

  expect(jest.getTimerCount()).toBe(0);
  await act(async () => {
    await flushPromises();
  });
  expect(AdMob.removeBanner).toHaveBeenCalled();
});

test('AppVideoManager restarts AdMob without replaying startup splash when app becomes visible again', async () => {
  const { container } = await renderNativeAdMobPhase();

  expect(container.querySelector('.app-video-splash')).not.toBeInTheDocument();
  expect(AdMob.showBanner).toHaveBeenCalled();
  const showBannerCount = AdMob.showBanner.mock.calls.length;

  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'hidden',
  });
  fireEvent(document, new Event('visibilitychange'));
  await act(async () => {
    await flushPromises();
  });

  expect(container.querySelector('.app-video-splash')).not.toBeInTheDocument();
  expect(AdMob.removeBanner).toHaveBeenCalled();

  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  });
  fireEvent(document, new Event('visibilitychange'));
  await act(async () => {
    await flushPromises();
  });

  expect(container.querySelector('.app-video-splash')).not.toBeInTheDocument();
  expect(AdMob.showBanner).toHaveBeenCalledTimes(showBannerCount + 1);
});

test('AppVideoManager expands floating video on tap and collapses from backdrop', async () => {
  const { container } = await renderNativeLocalVideoPhase();
  const widget = container.querySelector('.floating-video-widget');

  fireEvent.pointerDown(widget, { pointerId: 1, clientX: 40, clientY: 40, button: 0 });
  fireEvent.pointerUp(widget, { pointerId: 1, clientX: 40, clientY: 40, button: 0 });

  expect(widget).toHaveClass('expanded');
  expect(container.querySelector('.floating-video-backdrop')).toBeInTheDocument();

  fireEvent.pointerDown(container.querySelector('.floating-video-backdrop'));

  expect(widget).not.toHaveClass('expanded');
  expect(container.querySelector('.floating-video-backdrop')).not.toBeInTheDocument();
});

test('AppVideoManager keeps floating popup muted until the user taps to expand it', async () => {
  const { container } = await renderNativeLocalVideoPhase();
  const widget = container.querySelector('.floating-video-widget');
  const video = widget.querySelector('video');

  expect(video.muted).toBe(true);

  fireEvent.pointerDown(widget, { pointerId: 1, clientX: 40, clientY: 40, button: 0 });
  fireEvent.pointerUp(widget, { pointerId: 1, clientX: 40, clientY: 40, button: 0 });

  expect(widget).toHaveClass('expanded');
  expect(video.muted).toBe(false);

  fireEvent.pointerDown(container.querySelector('.floating-video-backdrop'));

  expect(widget).not.toHaveClass('expanded');
  expect(video.muted).toBe(true);
});

test('AppVideoManager close button dismisses floating video for the current session', async () => {
  const { container } = await renderNativeLocalVideoPhase();

  fireEvent.click(screen.getByLabelText(/close local video promo/i));

  expect(container.querySelector('.floating-video-widget')).not.toBeInTheDocument();

  await advanceTimers(POPUP_REPEAT_INTERVAL_MS);

  expect(container.querySelector('.floating-video-widget')).not.toBeInTheDocument();
  expectLastBannerAdId('ca-app-pub-3940256099942544/6300978111');
});

test('AppVideoManager drag movement does not expand floating video', async () => {
  const { container } = await renderNativeLocalVideoPhase();
  const widget = container.querySelector('.floating-video-widget');

  fireEvent.pointerDown(widget, { pointerId: 1, clientX: 40, clientY: 40, button: 0 });
  fireEvent.pointerMove(widget, { pointerId: 1, clientX: 58, clientY: 40, button: 0 });
  fireEvent.pointerUp(widget, { pointerId: 1, clientX: 58, clientY: 40, button: 0 });

  expect(widget).not.toHaveClass('expanded');
  expect(container.querySelector('.floating-video-backdrop')).not.toBeInTheDocument();
});


test('AppVideoManager retries the AdMob banner after a load timeout', async () => {
  const view = renderNativeVideoManager({ enableLocalVideo: true });

  await act(async () => {
    await flushPromises();
  });

  const { container } = view;

  expect(container.querySelector('.floating-video-widget')).not.toBeInTheDocument();
  expect(AdMob.showBanner).toHaveBeenCalledTimes(1);

  await advanceTimers(8000);
  await advanceTimers(BANNER_ONLY_PHASE_MS - 8000);

  expect(container.querySelector('.floating-video-widget')).toBeInTheDocument();
  expect(AdMob.showBanner).toHaveBeenCalledTimes(2);
});

test('REACT_APP_USE_ADMOB_TEST_ADS defaults to true', async () => {
  const { isolatedAdMob } = await showBannerWithIsolatedAdMobEnv(undefined);

  expect(isolatedAdMob.initialize).toHaveBeenCalledWith({
    initializeForTesting: true,
  });
  expect(isolatedAdMob.showBanner).toHaveBeenCalledWith(
    expect.objectContaining({
      adId: 'ca-app-pub-3940256099942544/6300978111',
      isTesting: true,
    })
  );
});

test('local/test builds keep Google demo ads even when REACT_APP_USE_ADMOB_TEST_ADS=false', async () => {
  const { isolatedAdMob } = await showBannerWithIsolatedAdMobEnv('false');

  expect(isolatedAdMob.initialize).toHaveBeenCalledWith({
    initializeForTesting: true,
  });
  expect(isolatedAdMob.showBanner).toHaveBeenCalledWith(
    expect.objectContaining({
      adId: 'ca-app-pub-3940256099942544/6300978111',
      isTesting: true,
    })
  );
});

test('production mode uses the env production banner ID', async () => {
  const { isolatedAdMob, result } = await showBannerWithIsolatedAdMobEnv('false', {
    NODE_ENV: 'production',
    REACT_APP_ADMOB_ANDROID_BANNER_ID: 'ca-app-pub-1111222233334444/5555666677',
  });

  expect(result).toBe(true);
  expect(isolatedAdMob.initialize).toHaveBeenCalledWith({
    initializeForTesting: false,
  });
  expect(isolatedAdMob.showBanner).toHaveBeenCalledWith(
    expect.objectContaining({
      adId: 'ca-app-pub-1111222233334444/5555666677',
      isTesting: false,
    })
  );
});

test('production mode skips the banner when the env production ID is missing', async () => {
  const { isolatedAdMob, result } = await showBannerWithIsolatedAdMobEnv('false', {
    NODE_ENV: 'production',
    REACT_APP_ADMOB_ANDROID_BANNER_ID: undefined,
  });

  expect(result).toBe(false);
  expect(isolatedAdMob.showBanner).not.toHaveBeenCalled();
});
