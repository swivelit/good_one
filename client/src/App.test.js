import { render, screen } from '@testing-library/react';
import App from './App';
import MobileWelcomePage from './pages/MobileWelcomePage';

jest.mock('react-router-dom', () => {
  const React = require('react');

  return {
    BrowserRouter: ({ children }) => <>{children}</>,
    HashRouter: ({ children }) => <>{children}</>,
    Routes: () => null,
    Route: () => null,
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

test('renders GoodOne app shell', () => {
  render(<App />);
  expect(screen.getAllByText(/GoodOne/i).length).toBeGreaterThan(0);
});

test('MobileWelcomePage renders native auth choices', () => {
  render(<MobileWelcomePage />);

  expect(screen.getByText(/GoodOne/i)).toBeInTheDocument();
  expect(screen.getByText(/Sign In/i)).toBeInTheDocument();
  expect(screen.getByText(/Create Customer Account/i)).toBeInTheDocument();
  expect(screen.getByText(/Become a Vendor/i)).toBeInTheDocument();
  expect(screen.getByText(/Continue Browsing/i)).toBeInTheDocument();
});
