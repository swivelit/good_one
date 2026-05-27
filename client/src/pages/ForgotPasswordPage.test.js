import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import ForgotPasswordPage from './ForgotPasswordPage';
import { authAPI } from '../api';

const mockNavigate = jest.fn();

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
    requestPasswordResetOtp: jest.fn(),
    resetPassword: jest.fn(),
  },
}));

const enterEmailAndRequestOtp = async () => {
  authAPI.requestPasswordResetOtp.mockResolvedValue({ data: { success: true } });

  render(<ForgotPasswordPage />);

  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'customer@example.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: /send otp/i }));

  await waitFor(() => {
    expect(authAPI.requestPasswordResetOtp).toHaveBeenCalledWith({
      email: 'customer@example.com',
    });
  });
  await screen.findByLabelText('OTP');
};

beforeEach(() => {
  mockNavigate.mockClear();
  authAPI.requestPasswordResetOtp.mockReset();
  authAPI.resetPassword.mockReset();
  toast.success.mockClear();
  toast.error.mockClear();
});

test('renders forgot password email step', () => {
  render(<ForgotPasswordPage />);

  expect(screen.getByRole('heading', { name: /reset your password/i })).toBeInTheDocument();
  expect(screen.getByLabelText('Email')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /send otp/i })).toBeInTheDocument();
});

test('request OTP success reveals OTP and password fields', async () => {
  await enterEmailAndRequestOtp();

  expect(screen.getByLabelText('OTP')).toBeInTheDocument();
  expect(screen.getByLabelText('New password')).toBeInTheDocument();
  expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
});

test('unregistered email displays error', async () => {
  authAPI.requestPasswordResetOtp.mockRejectedValue({
    response: { data: { message: 'This email is not registered' } },
  });

  render(<ForgotPasswordPage />);

  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'missing@example.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: /send otp/i }));

  expect(await screen.findByText('This email is not registered')).toBeInTheDocument();
  expect(toast.error).toHaveBeenCalledWith('This email is not registered');
});

test('password mismatch prevents reset', async () => {
  await enterEmailAndRequestOtp();

  fireEvent.change(screen.getByLabelText('OTP'), {
    target: { value: '111111' },
  });
  fireEvent.change(screen.getByLabelText('New password'), {
    target: { value: 'Reset@Test12345' },
  });
  fireEvent.change(screen.getByLabelText('Confirm password'), {
    target: { value: 'Reset@Test54321' },
  });
  fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

  expect(authAPI.resetPassword).not.toHaveBeenCalled();
  expect(toast.error).toHaveBeenCalledWith('Passwords do not match');
});

test('successful reset calls API and navigates to login', async () => {
  await enterEmailAndRequestOtp();
  authAPI.resetPassword.mockResolvedValue({ data: { success: true } });

  fireEvent.change(screen.getByLabelText('OTP'), {
    target: { value: '111111' },
  });
  fireEvent.change(screen.getByLabelText('New password'), {
    target: { value: 'Reset@Test12345' },
  });
  fireEvent.change(screen.getByLabelText('Confirm password'), {
    target: { value: 'Reset@Test12345' },
  });
  fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

  await waitFor(() => {
    expect(authAPI.resetPassword).toHaveBeenCalledWith({
      email: 'customer@example.com',
      otp: '111111',
      newPassword: 'Reset@Test12345',
    });
  });
  expect(toast.success).toHaveBeenCalledWith('Password reset successfully. Please login.');
  expect(mockNavigate).toHaveBeenCalledWith('/login');
});
