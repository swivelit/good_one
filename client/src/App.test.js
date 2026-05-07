import { act, fireEvent, render, screen } from '@testing-library/react';
import { Capacitor } from '@capacitor/core';
import { AdMob } from '@capacitor-community/admob';
import App from './App';
import AppVideoManager from './components/AppVideoManager';
import MobileWelcomePage from './pages/MobileWelcomePage';

jest.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: jest.fn(() => false),
    getPlatform: jest.fn(() => 'android'),
  },
}));

jest.mock('@capacitor-community/admob', () => ({
  AdMob: {
    initialize: jest.fn(() => Promise.resolve()),
    showBanner: jest.fn(() => Promise.resolve()),
    hideBanner: jest.fn(() => Promise.resolve()),
    removeBanner: jest.fn(() => Promise.resolve()),
  },
  BannerAdSize: {
    ADAPTIVE_BANNER: 'ADAPTIVE_BANNER',
  },
  BannerAdPosition: {
    BOTTOM_CENTER: 'BOTTOM_CENTER',
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
});

test('MobileWelcomePage renders native auth choices', () => {
  render(<MobileWelcomePage />);

  expect(screen.getByText(/GoodOne/i)).toBeInTheDocument();
  expect(screen.getByText(/Sign In/i)).toBeInTheDocument();
  expect(screen.getByText(/Create Customer Account/i)).toBeInTheDocument();
  expect(screen.getByText(/Become a Vendor/i)).toBeInTheDocument();
  expect(screen.getByText(/Continue Browsing/i)).toBeInTheDocument();
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

const ONE_MINUTE_AD_LOOP_MS = 60000;
const LOCAL_VIDEO_DURATION_MS = 10000;
const INTRO_TIMEOUT_MS = LOCAL_VIDEO_DURATION_MS;
const GOOGLE_AD_DURATION_MS = ONE_MINUTE_AD_LOOP_MS - LOCAL_VIDEO_DURATION_MS;

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
      margin: 72,
      isTesting: true,
    })
  );
};

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
  expectLastBannerAdId('ca-app-pub-9859771616835832/2509706314');
});

test('AppVideoManager shows local popup video after the 50-second AdMob phase', async () => {
  const { container } = await renderNativeLocalVideoPhase();

  expect(container.querySelector('.floating-video-widget')).toBeInTheDocument();
  expect(screen.queryByLabelText(/close video/i)).not.toBeInTheDocument();
});

test('AppVideoManager returns to AdMob after 10 seconds of local popup video', async () => {
  const { container } = await renderNativeLocalVideoPhase();

  expect(container.querySelector('.floating-video-widget')).toBeInTheDocument();

  await advanceTimers(LOCAL_VIDEO_DURATION_MS);

  expect(container.querySelector('.floating-video-widget')).not.toBeInTheDocument();
  expectLastBannerAdId('ca-app-pub-9859771616835832/2509706314');
});

test('AppVideoManager uses the Android banner ad unit by default', async () => {
  await renderNativeAdMobPhase();

  expectLastBannerAdId('ca-app-pub-9859771616835832/2509706314');
});

test('AppVideoManager uses the iOS banner ad unit on iOS', async () => {
  Capacitor.getPlatform.mockReturnValue('ios');

  await renderNativeAdMobPhase();

  expectLastBannerAdId('ca-app-pub-9859771616835832/9324413170');
});

test('AppVideoManager returns to local video after the AdMob phase', async () => {
  const { container } = await renderNativeAdMobPhase();
  const removeBannerCount = AdMob.removeBanner.mock.calls.length;

  expect(container.querySelector('.floating-video-widget')).not.toBeInTheDocument();

  await advanceTimers(GOOGLE_AD_DURATION_MS - 1);

  expect(container.querySelector('.floating-video-widget')).not.toBeInTheDocument();

  await advanceTimers(1);

  expect(AdMob.removeBanner).toHaveBeenCalledTimes(removeBannerCount + 1);
  expect(container.querySelector('.floating-video-widget')).toBeInTheDocument();
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

test('REACT_APP_USE_ADMOB_TEST_ADS defaults to true', async () => {
  const isolatedAdMob = await showBannerWithIsolatedAdMobEnv(undefined);

  expect(isolatedAdMob.initialize).toHaveBeenCalledWith({
    initializeForTesting: true,
  });
  expect(isolatedAdMob.showBanner).toHaveBeenCalledWith(
    expect.objectContaining({
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
