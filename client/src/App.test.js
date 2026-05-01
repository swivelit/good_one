import { render, screen } from '@testing-library/react';
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
