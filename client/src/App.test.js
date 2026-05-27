import fs from 'fs';
import path from 'path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Capacitor } from '@capacitor/core';
import { AdMob } from '@capacitor-community/admob';
import App from './App';
import AppVideoManager, { syncNativeViewportCssVariables } from './components/AppVideoManager';
import MobileWelcomePage from './pages/MobileWelcomePage';

const mockAdMobListeners = {};
const androidResDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

const walkFiles = (directory) => (
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(entryPath) : entryPath;
  })
);

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
    addListener: jest.fn((eventName, callback) => {
      mockAdMobListeners[eventName] = callback;
      return { remove: jest.fn() };
    }),
    showBanner: jest.fn(() => Promise.resolve()),
    hideBanner: jest.fn(() => Promise.resolve()),
    removeBanner: jest.fn(() => Promise.resolve()),
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
    useLocation: () => ({ pathname: '/', search: '', hash: '', state: null }),
    useParams: () => ({}),
    useSearchParams: () => [new URLSearchParams(), jest.fn()],
  };
}, { virtual: true });

beforeEach(() => {
  jest.clearAllMocks();
  document.body.className = '';
  document.documentElement.removeAttribute('style');
  jest.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
  Capacitor.isNativePlatform.mockReturnValue(false);
  Capacitor.getPlatform.mockReturnValue('android');
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  });
  localStorage.clear();
});

afterEach(() => {
  jest.useRealTimers();
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

test('AppVideoManager stays hidden on web', () => {
  Capacitor.isNativePlatform.mockReturnValue(false);

  const { container } = render(<AppVideoManager />);

  expect(container.querySelector('.app-video-splash')).not.toBeInTheDocument();
  expect(container.querySelector('.floating-video-widget')).not.toBeInTheDocument();
});

test('AppVideoManager renders splash only in native Capacitor mode', () => {
  Capacitor.isNativePlatform.mockReturnValue(true);

  const { container } = render(<AppVideoManager />);

  expect(container.querySelector('.app-video-splash')).toBeInTheDocument();
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

const POPUP_REPEAT_INTERVAL_MS = 20000;
const LOCAL_VIDEO_DURATION_MS = 10000;
const INTRO_TIMEOUT_MS = LOCAL_VIDEO_DURATION_MS;
const GOOGLE_AD_DURATION_MS = POPUP_REPEAT_INTERVAL_MS - LOCAL_VIDEO_DURATION_MS;

const flushPromises = async () => {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
};

const advanceTimers = async (milliseconds) => {
  await act(async () => {
    jest.advanceTimersByTime(milliseconds);
    await flushPromises();
  });
};

const renderNativeVideoManager = () => {
  jest.useFakeTimers();
  Capacitor.isNativePlatform.mockReturnValue(true);

  return render(<AppVideoManager />);
};

const renderNativeAdMobPhase = async () => {
  const view = renderNativeVideoManager();

  await advanceTimers(INTRO_TIMEOUT_MS);
  return view;
};

const renderNativeLocalVideoPhase = async () => {
  const view = await renderNativeAdMobPhase();

  await advanceTimers(GOOGLE_AD_DURATION_MS);
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

const showBannerWithIsolatedAdMobEnv = async (envValue) => {
  const previousEnvValue = process.env.REACT_APP_USE_ADMOB_TEST_ADS;

  if (envValue === undefined) {
    delete process.env.REACT_APP_USE_ADMOB_TEST_ADS;
  } else {
    process.env.REACT_APP_USE_ADMOB_TEST_ADS = envValue;
  }

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
  await showAdMobBanner();

  if (previousEnvValue === undefined) {
    delete process.env.REACT_APP_USE_ADMOB_TEST_ADS;
  } else {
    process.env.REACT_APP_USE_ADMOB_TEST_ADS = previousEnvValue;
  }

  return isolatedAdMob;
};

test('AppVideoManager shows AdMob after the 10-second launch video', async () => {
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

test('AppVideoManager shows local popup video after the 10-second AdMob phase while keeping the bottom banner', async () => {
  const { container } = await renderNativeLocalVideoPhase();

  expect(container.querySelector('.floating-video-widget')).toBeInTheDocument();
  expect(screen.queryByLabelText(/close video/i)).not.toBeInTheDocument();
  expect(AdMob.removeBanner).not.toHaveBeenCalled();
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
  const { container } = await renderNativeAdMobPhase();
  const removeBannerCount = AdMob.removeBanner.mock.calls.length;

  expect(container.querySelector('.floating-video-widget')).not.toBeInTheDocument();

  await advanceTimers(GOOGLE_AD_DURATION_MS - 1);

  expect(container.querySelector('.floating-video-widget')).not.toBeInTheDocument();

  await advanceTimers(1);

  expect(AdMob.removeBanner).toHaveBeenCalledTimes(removeBannerCount);
  expect(container.querySelector('.floating-video-widget')).toBeInTheDocument();
  expectLastBannerAdId('ca-app-pub-3940256099942544/6300978111');
});

test('AppVideoManager clears timers and removes banner on unmount', async () => {
  const { unmount } = renderNativeVideoManager();

  expect(jest.getTimerCount()).toBeGreaterThan(0);

  unmount();

  expect(jest.getTimerCount()).toBe(0);
  await act(async () => {
    await flushPromises();
  });
  expect(AdMob.removeBanner).toHaveBeenCalled();
});

test('AppVideoManager replays the 10-second splash video when app becomes visible again', async () => {
  const { container } = await renderNativeAdMobPhase();

  expect(container.querySelector('.app-video-splash')).not.toBeInTheDocument();
  expect(AdMob.showBanner).toHaveBeenCalled();

  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'hidden',
  });
  fireEvent(document, new Event('visibilitychange'));

  expect(container.querySelector('.app-video-splash')).not.toBeInTheDocument();

  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => 'visible',
  });
  fireEvent(document, new Event('visibilitychange'));

  expect(container.querySelector('.app-video-splash')).toBeInTheDocument();
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

test('AppVideoManager has no close button after expanding floating video', async () => {
  const { container } = await renderNativeLocalVideoPhase();
  const widget = container.querySelector('.floating-video-widget');

  fireEvent.pointerDown(widget, { pointerId: 1, clientX: 40, clientY: 40, button: 0 });
  fireEvent.pointerUp(widget, { pointerId: 1, clientX: 40, clientY: 40, button: 0 });

  expect(screen.queryByLabelText(/close video/i)).not.toBeInTheDocument();
  expect(container.querySelector('.floating-video-widget')).toBeInTheDocument();
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
  const { container } = await renderNativeAdMobPhase();

  expect(container.querySelector('.floating-video-widget')).not.toBeInTheDocument();
  expect(AdMob.showBanner).toHaveBeenCalledTimes(1);

  await advanceTimers(8000);
  await advanceTimers(GOOGLE_AD_DURATION_MS - 8000);

  expect(container.querySelector('.floating-video-widget')).toBeInTheDocument();
  expect(AdMob.showBanner).toHaveBeenCalledTimes(2);
});

test('REACT_APP_USE_ADMOB_TEST_ADS defaults to true', async () => {
  const isolatedAdMob = await showBannerWithIsolatedAdMobEnv(undefined);

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

test('REACT_APP_USE_ADMOB_TEST_ADS=false makes showBanner use isTesting:false', async () => {
  const isolatedAdMob = await showBannerWithIsolatedAdMobEnv('false');

  expect(isolatedAdMob.initialize).toHaveBeenCalledWith({
    initializeForTesting: false,
  });
  expect(isolatedAdMob.showBanner).toHaveBeenCalledWith(
    expect.objectContaining({
      isTesting: false,
    })
  );
});
