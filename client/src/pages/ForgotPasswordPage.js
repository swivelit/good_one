import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authAPI } from '../api';

const initialForm = {
  email: '',
  otp: '',
  newPassword: '',
  confirmPassword: '',
};

export default function ForgotPasswordPage() {
  const [form, setForm] = useState(initialForm);
  const [otpSent, setOtpSent] = useState(false);
  const [loadingOtp, setLoadingOtp] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (errorMessage) setErrorMessage('');
  };

  const getApiErrorMessage = (error, fallback) =>
    error.response?.data?.message || fallback;

  const validateEmail = () => {
    const email = form.email.trim();

    if (!email) {
      toast.error('Email is required');
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Enter a valid email');
      return false;
    }

    return true;
  };

  const handleSendOtp = async () => {
    if (!validateEmail()) return;

    try {
      setLoadingOtp(true);
      await authAPI.requestPasswordResetOtp({ email: form.email });
      setOtpSent(true);
      toast.success('OTP sent to your email');
    } catch (error) {
      const message = getApiErrorMessage(error, 'Failed to send OTP');
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoadingOtp(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();

    if (!validateEmail()) return;

    if (!form.otp.trim()) {
      return toast.error('OTP is required');
    }

    if (!form.newPassword) {
      return toast.error('New password is required');
    }

    if (form.newPassword.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }

    if (form.newPassword !== form.confirmPassword) {
      return toast.error('Passwords do not match');
    }

    try {
      setResetting(true);
      await authAPI.resetPassword({
        email: form.email,
        otp: form.otp,
        newPassword: form.newPassword,
      });
      toast.success('Password reset successfully. Please login.');
      navigate('/login');
    } catch (error) {
      const message = getApiErrorMessage(error, 'Password reset failed');
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <i className="bi bi-shield-lock display-5 mb-2 d-block"></i>
          <h4 className="fw-bold mb-1">Reset Your Password</h4>
          <p className="opacity-80 mb-0 small">Use an email OTP to set a new password</p>
        </div>

        <div className="auth-body">
          {errorMessage && (
            <div className="alert alert-danger py-2 small" role="alert">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleResetPassword}>
            <div className="mb-3">
              <label className="form-label fw-semibold small" htmlFor="forgotPasswordEmail">
                Email
              </label>
              <div className="input-group">
                <span className="input-group-text bg-light">
                  <i className="bi bi-envelope text-muted"></i>
                </span>
                <input
                  id="forgotPasswordEmail"
                  type="email"
                  className="form-control"
                  placeholder="Enter your registered email"
                  value={form.email}
                  onChange={(event) => updateForm('email', event.target.value)}
                  required
                />
              </div>
            </div>

            {!otpSent ? (
              <button
                type="button"
                className="btn btn-primary-custom w-100 py-2"
                onClick={handleSendOtp}
                disabled={loadingOtp}
              >
                {loadingOtp ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    Sending...
                  </>
                ) : (
                  <>
                    <i className="bi bi-send me-2"></i>
                    Send OTP
                  </>
                )}
              </button>
            ) : (
              <>
                <div className="mb-3">
                  <label className="form-label fw-semibold small" htmlFor="forgotPasswordOtp">
                    OTP
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-light">
                      <i className="bi bi-key text-muted"></i>
                    </span>
                    <input
                      id="forgotPasswordOtp"
                      type="text"
                      inputMode="numeric"
                      className="form-control"
                      placeholder="Enter 6-digit OTP"
                      value={form.otp}
                      onChange={(event) => updateForm('otp', event.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label fw-semibold small" htmlFor="newPassword">
                    New password
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-light">
                      <i className="bi bi-lock text-muted"></i>
                    </span>
                    <input
                      id="newPassword"
                      type={showNewPassword ? 'text' : 'password'}
                      className="form-control"
                      placeholder="Enter new password"
                      value={form.newPassword}
                      onChange={(event) => updateForm('newPassword', event.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="input-group-text bg-light"
                      onClick={() => setShowNewPassword((visible) => !visible)}
                      aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                    >
                      <i className={`bi ${showNewPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                    </button>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="form-label fw-semibold small" htmlFor="confirmPassword">
                    Confirm password
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-light">
                      <i className="bi bi-lock-fill text-muted"></i>
                    </span>
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      className="form-control"
                      placeholder="Confirm new password"
                      value={form.confirmPassword}
                      onChange={(event) => updateForm('confirmPassword', event.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="input-group-text bg-light"
                      onClick={() => setShowConfirmPassword((visible) => !visible)}
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      <i className={`bi ${showConfirmPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary-custom w-100 py-2"
                  disabled={resetting}
                >
                  {resetting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Resetting...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-circle me-2"></i>
                      Reset Password
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="btn btn-link w-100 mt-3"
                  onClick={handleSendOtp}
                  disabled={loadingOtp}
                >
                  {loadingOtp ? 'Resending...' : 'Resend OTP'}
                </button>
              </>
            )}
          </form>

          <div className="text-center mt-4">
            <small>
              Remembered your password? <Link to="/login">Sign in</Link>
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}
