import { act, fireEvent, render, screen } from '@testing-library/react';
import { Capacitor } from '@capacitor/core';
import { AdMob } from '@capacitor-community/admob';
import App from './App';
import AppVideoManager from './components/AppVideoManager';
import MobileWelcomePage from './pages/MobileWelcomePage';

jest.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: jest.fn(() => false),
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

const INTRO_TIMEOUT_MS = 4000;
const POPUP_DELAY_MS = 5000;
const GOOGLE_AD_CYCLE_MS = 60000;
const GOOGLE_AD_CYCLES_BEFORE_LOCAL_VIDEO = 5;
const LOCAL_VIDEO_DURATION_MS = 3000;

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

const renderNativeAdPhase = async () => {
  const view = renderNativeVideoManager();

  await advanceTimers(INTRO_TIMEOUT_MS);
  await advanceTimers(POPUP_DELAY_MS);

  return view;
};

const advanceAdCycles = async (cycleCount) => {
  for (let index = 0; index < cycleCount; index += 1) {
    await advanceTimers(GOOGLE_AD_CYCLE_MS);
  }
};

const renderNativeLocalVideoPhase = async () => {
  const view = await renderNativeAdPhase();

  await advanceAdCycles(GOOGLE_AD_CYCLES_BEFORE_LOCAL_VIDEO);

  return view;
};

test('AppVideoManager starts AdMob after splash and popup delay', async () => {
  const { container } = await renderNativeAdPhase();

  expect(AdMob.showBanner).toHaveBeenCalledWith(
    expect.objectContaining({
      adId: 'ca-app-pub-9859771616835832/2509706314',
      adSize: 'ADAPTIVE_BANNER',
      position: 'BOTTOM_CENTER',
      margin: expect.any(Number),
      isTesting: true,
    })
  );
  expect(container.querySelector('.floating-video-widget')).not.toBeInTheDocument();
});

test('AppVideoManager keeps local video hidden after four AdMob cycles', async () => {
  const { container } = await renderNativeAdPhase();

  await advanceAdCycles(GOOGLE_AD_CYCLES_BEFORE_LOCAL_VIDEO - 1);

  expect(container.querySelector('.floating-video-widget')).not.toBeInTheDocument();
  expect(AdMob.removeBanner).not.toHaveBeenCalled();
});

test('AppVideoManager shows local video after the fifth AdMob cycle', async () => {
  const { container } = await renderNativeAdPhase();

  await advanceAdCycles(GOOGLE_AD_CYCLES_BEFORE_LOCAL_VIDEO);

  expect(AdMob.removeBanner).toHaveBeenCalled();
  expect(container.querySelector('.floating-video-widget')).toBeInTheDocument();
  expect(screen.queryByLabelText(/close video/i)).not.toBeInTheDocument();
});

test('AppVideoManager returns to AdMob after three seconds of local video', async () => {
  const { container } = await renderNativeLocalVideoPhase();
  const adMobShowCount = AdMob.showBanner.mock.calls.length;

  expect(container.querySelector('.floating-video-widget')).toBeInTheDocument();

  await advanceTimers(LOCAL_VIDEO_DURATION_MS);

  expect(container.querySelector('.floating-video-widget')).not.toBeInTheDocument();
  expect(AdMob.showBanner).toHaveBeenCalledTimes(adMobShowCount + 1);
});

test('AppVideoManager clears timers on unmount', () => {
  const { unmount } = renderNativeVideoManager();

  expect(jest.getTimerCount()).toBeGreaterThan(0);

  unmount();

  expect(jest.getTimerCount()).toBe(0);
});

test('AppVideoManager stops the AdMob cycle on unmount', async () => {
  const { unmount } = await renderNativeAdPhase();
  const adMobShowCount = AdMob.showBanner.mock.calls.length;

  unmount();
  await advanceTimers(GOOGLE_AD_CYCLE_MS * GOOGLE_AD_CYCLES_BEFORE_LOCAL_VIDEO);

  expect(AdMob.showBanner).toHaveBeenCalledTimes(adMobShowCount);
  expect(AdMob.removeBanner).toHaveBeenCalled();
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
