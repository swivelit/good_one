import { act, fireEvent, render, screen } from '@testing-library/react';
import { Capacitor } from '@capacitor/core';
import App from './App';
import AppVideoManager from './components/AppVideoManager';
import MobileWelcomePage from './pages/MobileWelcomePage';

jest.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: jest.fn(() => false),
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

const renderNativeFloatingVideo = () => {
  jest.useFakeTimers();
  Capacitor.isNativePlatform.mockReturnValue(true);

  const view = render(<AppVideoManager />);

  act(() => {
    jest.advanceTimersByTime(4000);
  });
  act(() => {
    jest.advanceTimersByTime(5000);
  });

  return view;
};

test('AppVideoManager renders floating video after five second native delay', () => {
  const { container } = renderNativeFloatingVideo();

  expect(container.querySelector('.floating-video-widget')).toBeInTheDocument();
  expect(screen.queryByLabelText(/close video/i)).not.toBeInTheDocument();
});

test('AppVideoManager expands floating video on tap and collapses from backdrop', () => {
  const { container } = renderNativeFloatingVideo();
  const widget = container.querySelector('.floating-video-widget');

  fireEvent.pointerDown(widget, { pointerId: 1, clientX: 40, clientY: 40, button: 0 });
  fireEvent.pointerUp(widget, { pointerId: 1, clientX: 40, clientY: 40, button: 0 });

  expect(widget).toHaveClass('expanded');
  expect(container.querySelector('.floating-video-backdrop')).toBeInTheDocument();

  fireEvent.pointerDown(container.querySelector('.floating-video-backdrop'));

  expect(widget).not.toHaveClass('expanded');
  expect(container.querySelector('.floating-video-backdrop')).not.toBeInTheDocument();
});

test('AppVideoManager has no close button after expanding floating video', () => {
  const { container } = renderNativeFloatingVideo();
  const widget = container.querySelector('.floating-video-widget');

  fireEvent.pointerDown(widget, { pointerId: 1, clientX: 40, clientY: 40, button: 0 });
  fireEvent.pointerUp(widget, { pointerId: 1, clientX: 40, clientY: 40, button: 0 });

  expect(screen.queryByLabelText(/close video/i)).not.toBeInTheDocument();
  expect(container.querySelector('.floating-video-widget')).toBeInTheDocument();
});

test('AppVideoManager drag movement does not expand floating video', () => {
  const { container } = renderNativeFloatingVideo();
  const widget = container.querySelector('.floating-video-widget');

  fireEvent.pointerDown(widget, { pointerId: 1, clientX: 40, clientY: 40, button: 0 });
  fireEvent.pointerMove(widget, { pointerId: 1, clientX: 58, clientY: 40, button: 0 });
  fireEvent.pointerUp(widget, { pointerId: 1, clientX: 58, clientY: 40, button: 0 });

  expect(widget).not.toHaveClass('expanded');
  expect(container.querySelector('.floating-video-backdrop')).not.toBeInTheDocument();
});
