import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../api';
import { useAuth } from '../AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [form, setForm] = useState({ emailOrPhone: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const { data } = await authAPI.login(form);
      login(data.token, data.user, data.vendorProfile);
      toast.success(`Welcome back, ${data.user.name}!`);
      navigate(data.user.role === 'vendor' ? '/dashboard' : '/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <i className="bi bi-shop-window display-4 mb-2 d-block"></i>
          <h4 className="fw-bold mb-1">Welcome Back to GoodOne</h4>
          <p className="opacity-80 mb-0 small">Sign in to continue shopping or selling</p>
        </div>
        <div className="auth-body">
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label fw-semibold small">Email or Phone</label>
              <div className="input-group">
                <span className="input-group-text bg-light"><i className="bi bi-person text-muted"></i></span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter email or phone number"
                  value={form.emailOrPhone}
                  onChange={e => setForm({...form, emailOrPhone: e.target.value})}
                  required
                />
              </div>
            </div>
            <div className="mb-4">
  <label className="form-label fw-semibold small">Password</label>

  <div className="input-group">
    {/* Lock Icon */}
    <span className="input-group-text bg-light">
      <i className="bi bi-lock text-muted"></i>
    </span>

    {/* Input Field */}
    <input
      type={showPassword ? "text" : "password"}
      className="form-control"
      placeholder="Enter your password"
      value={form.password}
      onChange={e => setForm({ ...form, password: e.target.value })}
      required
    />

    {/* Eye Icon */}
    <span
      className="input-group-text bg-light"
      style={{ cursor: "pointer" }}
      onClick={() => setShowPassword(!showPassword)}
    >
      <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`}></i>
    </span>
  </div>
</div>
            <button type="submit" className="btn btn-primary-custom w-100 py-2" disabled={loading}>
              {loading ? <><span className="spinner-border spinner-border-sm me-2"></span>Signing in...</> : <><i className="bi bi-box-arrow-in-right me-2"></i>Sign In</>}
            </button>
          </form>

          <div className="text-center mt-4">
            <p className="text-muted small mb-2">Don't have an account?</p>
            <div className="d-flex gap-2 justify-content-center">
              <Link to="/register/customer" className="btn btn-outline-secondary btn-sm">
                <i className="bi bi-person me-1"></i>Register as Customer
              </Link>
              <Link to="/register/vendor" className="btn btn-sm" style={{background:'#FF6B35',color:'#fff',borderRadius:8}}>
                <i className="bi bi-shop me-1"></i>Register as Vendor
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
