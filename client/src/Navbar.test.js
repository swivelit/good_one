import { fireEvent, render, screen } from '@testing-library/react';
import { Capacitor } from '@capacitor/core';
import Navbar from './Navbar';

const mockNavigate = jest.fn();
let mockLocation = { pathname: '/', search: '', hash: '', state: null };

jest.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: jest.fn(() => false),
  },
}));

jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => (
    <a href={typeof to === 'string' ? to : '#'} {...props}>
      {children}
    </a>
  ),
  useLocation: () => mockLocation,
  useNavigate: () => mockNavigate,
}), { virtual: true });

jest.mock('./AuthContext', () => ({
  useAuth: () => ({
    user: null,
    logout: jest.fn(),
  }),
}));

describe('Navbar search', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockLocation = { pathname: '/', search: '', hash: '', state: null };
    Capacitor.isNativePlatform.mockReturnValue(false);
  });

  test('submitting a search trims text and navigates to /browse', () => {
    render(<Navbar />);

    const input = screen.getByPlaceholderText(/search products/i);
    fireEvent.change(input, { target: { value: '  iphone  ' } });
    fireEvent.submit(input.closest('form'));

    expect(mockNavigate).toHaveBeenCalledWith('/browse?search=iphone');
  });

  test('clearing an active search navigates back to /browse', () => {
    mockLocation = { pathname: '/browse', search: '?search=iphone', hash: '', state: null };
    render(<Navbar />);

    const input = screen.getByPlaceholderText(/search products/i);
    fireEvent.change(input, { target: { value: '' } });

    expect(mockNavigate).toHaveBeenCalledWith('/browse');
  });
});
