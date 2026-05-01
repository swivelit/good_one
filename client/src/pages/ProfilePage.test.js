import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProfilePage from './ProfilePage';
import { authAPI } from '../api';

const mockNavigate = jest.fn();
const mockUpdateUser = jest.fn();
const mockLogout = jest.fn();
const mockProfileUser = {
  name: 'Good Customer',
  email: 'customer@example.com',
  phone: '9999999999',
  role: 'customer',
};

jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => (
    <a href={typeof to === 'string' ? to : '#'} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => mockNavigate,
}), { virtual: true });

jest.mock('react-hot-toast', () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../api', () => ({
  authAPI: {
    updateMe: jest.fn(),
  },
}));

jest.mock('../AuthContext', () => ({
  useAuth: () => ({
    user: mockProfileUser,
    updateUser: mockUpdateUser,
    logout: mockLogout,
  }),
}));

beforeEach(() => {
  mockNavigate.mockClear();
  mockUpdateUser.mockClear();
  mockLogout.mockClear();
  authAPI.updateMe.mockReset();
});

test('renders customer profile fields', () => {
  render(<ProfilePage />);

  expect(screen.getByRole('heading', { name: /my profile/i })).toBeInTheDocument();
  expect(screen.getByText(/update your name and contact number/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/name/i)).toHaveValue('Good Customer');
  expect(screen.getByLabelText(/contact number/i)).toHaveValue('9999999999');
  expect(screen.getByLabelText(/email/i)).toHaveValue('customer@example.com');
  expect(screen.getByLabelText(/role/i)).toHaveValue('customer');
});

test('saves through authAPI.updateMe and updates auth context', async () => {
  authAPI.updateMe.mockResolvedValue({
    data: {
      user: {
        name: 'Updated Customer',
        phone: '8888888888',
        email: 'customer@example.com',
        role: 'customer',
      },
    },
  });

  render(<ProfilePage />);

  fireEvent.change(screen.getByLabelText(/name/i), {
    target: { value: 'Updated Customer' },
  });
  fireEvent.change(screen.getByLabelText(/contact number/i), {
    target: { value: '8888888888' },
  });
  fireEvent.submit(screen.getByRole('button', { name: /save profile/i }).closest('form'));

  await waitFor(() => {
    expect(authAPI.updateMe).toHaveBeenCalledWith({
      name: 'Updated Customer',
      phone: '8888888888',
    });
  });
  expect(mockUpdateUser).toHaveBeenCalledWith({
    name: 'Updated Customer',
    phone: '8888888888',
    email: 'customer@example.com',
    role: 'customer',
  });
});
