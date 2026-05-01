import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authAPI } from "../api";
import { useAuth } from "../AuthContext";
import toast from "react-hot-toast";

export default function RegisterCustomer() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    otp: "",
  });

  const [timer, setTimer] = useState(0);
  const [resending, setResending] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

 
  const handleSendOtp = async () => {
    if (!form.email) {
      return toast.error("Enter email first");
    }

    try {
      setSendingOtp(true);

      await authAPI.sendOtp({ email: form.email });

      toast.success("OTP sent to your email 📩");
      setOtpSent(true);

      // ✅ Start 30 sec timer
      setTimer(30);

      const interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send OTP");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      setResending(true);

      await authAPI.sendOtp({ email: form.email });

      toast.success("OTP resent successfully 📩");

      // Restart timer
      setTimer(30);

      const interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      toast.error("Failed to resend OTP");
    } finally {
      setResending(false);
    }
  };

  // ✅ Register
  const handleRegister = async (e) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      return toast.error("Passwords do not match");
    }

    if (!form.otp) {
      return toast.error("Please enter OTP");
    }

    try {
      setLoading(true);

      const { data } = await authAPI.registerCustomer({
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        otp: form.otp,
      });

      login(data.token, data.user, null);

      toast.success("Account created successfully 🎉");
      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <i className="bi bi-person-plus display-5 mb-2 d-block"></i>
          <h4 className="fw-bold mb-1">Create Customer Account</h4>
          <p className="opacity-80 mb-0 small">
            Shop from registered vendors directly
          </p>
        </div>

        <div className="auth-body">
          <form onSubmit={handleRegister}>
            {/* Name */}
            <div className="mb-3">
              <label className="form-label small fw-semibold">
                Full Name *
              </label>
              <input
                type="text"
                className="form-control"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            {/* Email + Send OTP */}
            <div className="mb-3">
              <label className="form-label small fw-semibold">Email *</label>

              <div className="input-group">
                <input
                  type="email"
                  className="form-control"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />

                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={handleSendOtp}
                  disabled={sendingOtp}
                >
                  {sendingOtp ? "Sending..." : "Send OTP"}
                </button>
              </div>
            </div>

            {/* OTP Field */}
            {otpSent && (
              <div className="mb-3">
                <label className="form-label small fw-semibold">
                  Enter OTP
                </label>

                <input
                  type="text"
                  className="form-control mb-2"
                  placeholder="Enter OTP"
                  value={form.otp}
                  onChange={(e) => setForm({ ...form, otp: e.target.value })}
                />

                {/* 🔥 Resend Section */}
                <div className="d-flex justify-content-between align-items-center">
                  <small className="text-muted">
                    {timer > 0 ? `Resend in ${timer}s` : "Didn't receive OTP?"}
                  </small>

                  <button
                    type="button"
                    className="btn btn-link p-0"
                    onClick={handleResendOtp}
                    disabled={timer > 0 || resending}
                  >
                    {resending ? "Resending..." : "Resend OTP"}
                  </button>
                </div>
              </div>
            )}

            {/* Phone */}
            <div className="mb-3">
              <label className="form-label small fw-semibold">Phone</label>
              <input
                type="tel"
                className="form-control"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>

            {/* Password */}
            <div className="row g-3 mb-4">
              {/* Password */}
              <div className="col-6">
                <label>Password *</label>
                <div className="input-group">
                  <input
                    type={showPassword ? "text" : "password"} // ✅ FIXED
                    className="form-control"
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    required
                  />
                  <span
                    className="input-group-text"
                    style={{ cursor: "pointer" }}
                    onClick={() => setShowPassword(!showPassword)} // ✅ FIXED
                  >
                    <i
                      className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`}
                    ></i>
                  </span>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="col-6">
                <label>Confirm *</label>
                <div className="input-group">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    className="form-control"
                    value={form.confirmPassword}
                    onChange={(e) =>
                      setForm({ ...form, confirmPassword: e.target.value })
                    }
                    required
                  />
                  <span
                    className="input-group-text"
                    style={{ cursor: "pointer" }}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <i
                      className={`bi ${showConfirmPassword ? "bi-eye-slash" : "bi-eye"}`}
                    ></i>
                  </span>
                </div>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={loading}
            >
              {loading ? "Creating..." : "Create Account"}
            </button>
          </form>

          <div className="text-center mt-3">
            <small>
              Already have an account? <Link to="/login">Sign in</Link>
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}
