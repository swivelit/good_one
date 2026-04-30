import { render, screen } from '@testing-library/react';
import App from './App';

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
    useParams: () => ({}),
    useSearchParams: () => [new URLSearchParams(), jest.fn()],
  };
}, { virtual: true });

test('renders GoodOne app shell', () => {
  render(<App />);
  expect(screen.getAllByText(/GoodOne/i).length).toBeGreaterThan(0);
});
